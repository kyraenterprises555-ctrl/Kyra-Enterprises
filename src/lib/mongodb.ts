import mongoose, { ClientSession } from "mongoose";

interface KyraMongoState {
  instance: typeof mongoose | null;
  connecting: Promise<typeof mongoose> | null;
  replicaSetReady: boolean | null;
}

declare global {
  // eslint-disable-next-line no-var
  var kyraMongoState: KyraMongoState | undefined;
}

const mongoState: KyraMongoState = global.kyraMongoState ?? {
  instance: null,
  connecting: null,
  replicaSetReady: null,
};

global.kyraMongoState = mongoState;

export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is required for Kyra Enterprises database connectivity.");
  }

  if (mongoState.instance && mongoose.connection.readyState === 1) {
    return mongoState.instance;
  }

  if (!mongoState.connecting) {
    mongoState.connecting = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: process.env.NODE_ENV === "production" ? 5000 : 2000,
      socketTimeoutMS: 45000,
    });
  }

  try {
    mongoState.instance = await mongoState.connecting;
    if (mongoState.replicaSetReady === null && mongoose.connection.db) {
      try {
        const info = await mongoose.connection.db.admin().command({ hello: 1 });
        mongoState.replicaSetReady = Boolean(info.setName || info.msg === "isdbgrid");
      } catch {
        mongoState.replicaSetReady = false;
      }
    }
    return mongoState.instance;
  } catch (err) {
    mongoState.connecting = null;
    mongoState.instance = null;
    throw err;
  }
}

export async function runInMongoTransaction<T>(
  operation: (session?: ClientSession) => Promise<T>
): Promise<T> {
  await connectToDatabase();

  if (mongoState.replicaSetReady) {
    const dbSession = await mongoose.startSession();
    try {
      let output!: T;
      await dbSession.withTransaction(async () => {
        output = await operation(dbSession);
      });
      return output;
    } finally {
      await dbSession.endSession();
    }
  }

  return operation(undefined);
}

export default connectToDatabase;
