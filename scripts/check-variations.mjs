import { MongoClient } from "mongodb";

const passwords = [
  "Admin1234",
  "admin1234",
  "Admin@1234",
  "Admin1234!",
  "Admin123",
  "admin123",
  "Admin@123",
  "admin@123"
];

const usernames = [
  "kyraenterprises555_db_user",
  "kayraenterprises555_db_user"
];

for (const u of usernames) {
  for (const p of passwords) {
    const uri = `mongodb+srv://${u}:${encodeURIComponent(p)}@cluster0.qixixqm.mongodb.net/kayra_enterprises?retryWrites=true&w=majority`;
    try {
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
      await client.connect();
      console.log(`FOUND WORKING CREDENTIALS! Username: ${u}, Password: ${p}`);
      await client.close();
      process.exit(0);
    } catch {
      // ignore
    }
  }
}
console.log("No common password variation matched.");
