import fs from "node:fs";
import bcrypt from "bcryptjs";

const defaults = [
  {
    name: "Vivek Kr Jha",
    email: "admin@kyra.com",
    pass: "Admin@123",
    role: "admin",
    phone: "+91 7393931555",
  },
  {
    name: "Pooja Verma (Manager)",
    email: "manager@kyra.com",
    pass: "Manager@123",
    role: "manager",
    phone: "+91 98112 88899",
  },
  {
    name: "Amit Kumar (Billing Staff)",
    email: "staff@kyra.com",
    pass: "Staff@123",
    role: "billing_staff",
    phone: "+91 98112 55544",
  },
];

for (const file of ["src/lib/initial-data.json", ".data/store.json"]) {
  if (!fs.existsSync(file)) continue;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Array.isArray(data.users) && data.users.length > 0) {
    console.log("Users already exist in", file, "- skipping overwrite to protect existing admin details.");
    continue;
  }
  data.users = defaults.map((d) => ({
    _id: `user_${d.role}`,
    name: d.name,
    email: d.email,
    passwordHash: bcrypt.hashSync(d.pass, 12),
    role: d.role,
    phone: d.phone,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log("Synced RBAC users in", file);
}
