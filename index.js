const express = require('express')
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();

// middleware
app.use(cors());
app.use(express.json());

app.get('/', (req,res)=>{
  res.send("Medical camp server is cooking")
})

app.listen(port,()=>{
  console.log(`medical camp server running on port : ${port}`)
})