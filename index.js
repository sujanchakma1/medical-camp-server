const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Medical camp server is cooking");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ra0uaai.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const usersCollection = client.db("medical").collection("users");
    const campCollection = client.db("medical").collection("camp");
    const campParticipantsCollection = client
      .db("medical")
      .collection("participant");
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        if (!user.email) {
          return res.status(400).send({ message: "Email is required" });
        }
        // Check if user already exists
        const existingUser = await usersCollection.findOne({
          email: user.email,
        });
        if (existingUser) {
          return res
            .status(200)
            .send({ message: "User already exists", inserted: false });
        }
        // Insert user into collection
        const result = await usersCollection.insertOne(user);
        res.send({
          message: "User inserted successfully",
          inserted: true,
          data: result,
        });
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/camps", async (req, res) => {
      try {
        const camps = await campCollection.find().toArray();
        res.send(camps);
      } catch (error) {
        console.error("Error fetching camps:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get("/camps/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const camp = await campCollection.findOne({ _id: new ObjectId(id) });
        if (!camp) {
          return res.status(404).send({ message: "Camp not found" });
        }
        res.send(camp);
      } catch (error) {
        console.error("Error fetching camp:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get("/popular-camps", async (req, res) => {
      try {
        const camps = await campCollection
          .find()
          .sort({ participant_count: -1 }) // descending order
          .limit(6)
          .toArray();

        res.send(camps);
      } catch (error) {
        console.error("Error fetching popular camps:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // campParticipants collection
    app.post("/campParticipants", async (req, res) => {
      try {
        const data = req.body;

        // 🧪 Required validation (optional)
        if (!data?.camp_id || !data?.participant_email) {
          return res
            .status(400)
            .send({ message: "Missing camp_id or participant_email" });
        }

        // 1️⃣ Save to campParticipants collection
        const insertResult = await campParticipantsCollection.insertOne(data);

        // 2️⃣ Increase participant_count in campCollection
        const updateResult = await campCollection.updateOne(
          { _id: new ObjectId(data.camp_id) },
          { $inc: { participant_count: 1 } }
        );

        res.send({
          message: "Participant added successfully",
          insertedId: insertResult.insertedId,
          participantCountUpdated: updateResult.modifiedCount > 0,
        });
      } catch (error) {
        console.error("❌ Error in /campParticipants POST:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`medical camp server running on port : ${port}`);
});
