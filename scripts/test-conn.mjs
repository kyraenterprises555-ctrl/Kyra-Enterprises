import { MongoClient } from "mongodb";

const uris = [
  "mongodb+srv://kyraenterprises555_db_user:Admin1234@cluster0.qixixqm.mongodb.net/kyra_enterprises?authSource=admin&retryWrites=true&w=majority",
  "mongodb+srv://kyraenterprises555_db_user:Admin1234@cluster0.qixixqm.mongodb.net/kyra_enterprises?authMechanism=DEFAULT",
  "mongodb+srv://kyraenterprises555_db_user:Admin1234@cluster0.qixixqm.mongodb.net/?authSource=admin"
];

for (const uri of uris) {
  try {
    console.log("Testing authSource=admin...");
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    console.log("SUCCESS WITH authSource=admin!");
    await client.close();
    process.exit(0);
  } catch (e) {
    console.log("Failed:", e.message);
  }
}
