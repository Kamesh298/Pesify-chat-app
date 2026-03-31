import { config } from "dotenv";
import { connectDB } from "../lib/db.js";
import User from "../models/user.model.js";

config();

const seedUsers = [
  // 2 Female Users
  {
    email: "emma.thompson@example.com",
    fullname: "Emma Thompson",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/1.jpg",
  },
  {
    email: "olivia.miller@example.com",
    fullname: "Olivia Miller", 
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/women/2.jpg",
  },
  // 2 Male Users
  {
    email: "james.anderson@example.com",
    fullname: "James Anderson",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/1.jpg",
  },
  {
    email: "william.clark@example.com",
    fullname: "William Clark",
    password: "123456",
    profilePic: "https://randomuser.me/api/portraits/men/2.jpg",
  },
];

const seedDatabase = async () => {
  try {
    await connectDB();

    await User.insertMany(seedUsers);
    console.log("Database seeded successfully - 4 users added");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
};

// Call the function
seedDatabase();
