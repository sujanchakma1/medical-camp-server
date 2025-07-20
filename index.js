const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();
const stripe = require("stripe")(`${process.env.STRIPE_SECRET_KEY}`);

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
    const participantsCollection = client
      .db("medical")
      .collection("participant");
    const paymentCollection = client.db("medical").collection("payment");
    const feedbackCollection = client.db("medical").collection("feedback");

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
    // ✅ GET /users?email=xyz@gmail.com
    app.get("/users", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ message: "Email query is required" });
      }

      try {
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }
        res.send(user);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // server/routes/users.js
    app.patch("/users", async (req, res) => {
      const email = req.query.email;
      const updatedData = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email query required" });
      }

      try {
        const result = await usersCollection.updateOne(
          { email },
          { $set: updatedData }
        );

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Profile updated" });
        } else {
          res.send({ success: false, message: "No changes made" });
        }
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
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
    app.post("/participant", async (req, res) => {
      try {
        const data = req.body;

        // 🧪 Required validation (optional)
        if (!data?.camp_id || !data?.participant_email) {
          return res
            .status(400)
            .send({ message: "Missing camp_id or participant_email" });
        }

        // 1️⃣ Save to campParticipants collection
        const insertResult = await participantsCollection.insertOne(data);

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

    app.get("/participant/:participantId", async (req, res) => {
      const id = req.params.participantId;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: "Invalid participant ID" });
      }

      try {
        const participant = await participantsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!participant) {
          return res.status(404).send({ error: "Participant not found" });
        }

        res.send(participant);
      } catch (err) {
        console.error("Error fetching participant:", err);
        res.status(500).send({ error: "Server error" });
      }
    });

    app.get("/registered-camps", async (req, res) => {
      try {
        const result = await participantsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching participants:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });
    app.get("/participants", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ error: "Email is required" });
      }
      const result = await participantsCollection
        .find({ participant_email: email })
        .toArray();
      res.send(result);
    });

    app.patch("/confirm-registration/:id", async (req, res) => {
      const id = req.params.id;

      const result = await participantsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { confirmation_status: "Confirmed" } }
      );

      res.send(result);
    });

    app.delete("/cancel-registration/:id", async (req, res) => {
      const id = req.params.id;

      try {
        // Step 1: Find the participant first to get campId
        const participant = await participantsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!participant) {
          return res.status(404).send({ message: "Participant not found" });
        }

        const campId = participant.camp_id;

        // Step 2: Delete the participant entry
        const deleteResult = await participantsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        // Step 3: Decrease participant_count by 1 from camp collection
        const updateResult = await campCollection.updateOne(
          { _id: new ObjectId(campId) },
          { $inc: { participant_count: -1 } }
        );

        res.send({
          message: "Registration canceled and camp updated",
          deleteResult,
          updateResult,
        });
      } catch (error) {
        console.error("Error in cancel-registration:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // ✅ Add a new camp
    app.post("/camps", async (req, res) => {
      try {
        const camp = req.body;

        // Always set participant count to 0 when adding a new camp
        camp.participant_count = 0;

        const result = await campCollection.insertOne(camp);

        res.send({
          success: true,
          message: "Camp added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: "Failed to add camp",
          error: error.message,
        });
      }
    });

    app.delete("/delete-camp/:id", async (req, res) => {
      const id = req.params.id;
      const result = await campCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.patch("/update-camp/:id", async (req, res) => {
      const campId = req.params.id;
      const updatedData = req.body;

      try {
        const query = { _id: new ObjectId(campId) };
        const updateDoc = {
          $set: {
            camp_name: updatedData.camp_name,
            image: updatedData.image,
            camp_fees: updatedData.camp_fees,
            date_time: updatedData.date_time,
            location: updatedData.location,
            healthcare_professional: updatedData.healthcare_professional,
            description: updatedData.description,
            // optional: participant_count updated only if included
            ...(updatedData.participant_count && {
              participant_count: Number(updatedData.participant_count),
            }),
          },
        };

        const result = await campCollection.updateOne(query, updateDoc);

        if (result.modifiedCount > 0) {
          res.send({
            success: true,
            message: "Camp updated successfully",
          });
        } else {
          res.status(404).send({
            success: false,
            message: "No camp found or data unchanged",
          });
        }
      } catch (error) {
        console.error("Error updating camp:", error.message);
        res.status(500).send({
          success: false,
          message: "Server error while updating camp",
        });
      }
    });

    app.post("/create-payment-intent", async (req, res) => {
      const amountInCents = req.body.amountInCents;
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents,
          currency: "usd",
          automatic_payment_methods: { enabled: true },
        });
        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post("/payments", async (req, res) => {
      try {
        const { participantId, email, amount, paymentMethod, transactionId } =
          req.body;
        const paymentData = {
          participantId,
          email,
          amount,
          paymentMethod,
          transactionId,
          paid_at_string: new Date().toISOString(),
          paid_at: new Date(),
        };

        // Insert payment info
        const paymentResult = await paymentCollection.insertOne(paymentData);

        // Update camp's payment_status
        const campResult = await participantsCollection.updateOne(
          { _id: new ObjectId(participantId) },
          { $set: { payment_status: "Paid" } }
        );

        res.send(paymentResult);
      } catch (error) {
        console.error("Payment save failed:", error);
        res.status(500).send({ error: "Payment processing failed" });
      }
    });

    // FeedBack
    app.post("/feedback", async (req, res) => {
      const feedback = req.body;
      const result = await feedbackCollection.insertOne(feedback);
      res.send(result);
    });

    // GET all feedbacks
    app.get("/feedback", async (req, res) => {
      try {
        const result = await feedbackCollection
          .find()
          .sort({ date: -1 })
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to load feedbacks" });
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
