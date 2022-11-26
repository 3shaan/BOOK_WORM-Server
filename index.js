const express = require('express');
const cors = require('cors')
require('dotenv').config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_KEY);

const app = express();
const port = process.env.PORT || 5000;

//middle ware 
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get('/', (req, res) => {
    res.send('book worm server is running')
});

//token verify 
const verifyToken = (req,res,next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.sendStatus(403);
  }
  const token = jwt.verify(
    authorization,
    process.env.TOKEN_KEY,
    (err, decoded) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.decoded = decoded;
      return next();
    }
  );
}



// mongodb

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.00o20sl.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
    try {
        const categoriesCollection = client.db('books-worm').collection('categories');
        
        const BooksCollection = client.db('books-worm').collection('books');
        const UsersCollection = client.db('books-worm').collection('users');
        const soldProductCollection = client.db('books-worm').collection('soldProduct');
        const WishlistCollection = client.db('books-worm').collection('wishlist');


        app.get("/category",async (req, res) => {
            const result = await categoriesCollection.find({}).toArray();
         res.send(result);
        });

        // get books by category

        app.get("/category/:books", async (req, res) => {
          const books = req.params.books;
            const query = { genre: books }
            const result = await BooksCollection.find(query).toArray();
            res.send(result);
        });
        
        // get book details by book id 
           app.get("/books/:id", async (req, res) => {
               const id = req.params.id;
             const query = { _id:ObjectId(id) };
               const result = await BooksCollection.findOne(query);
             res.send(result);
           });

       // user stored in data base
      
      app.post('/users', async (req, res) => {
        const data = req.body.data;
      
        const query = {email: data?.email}
        const result = await UsersCollection.insertOne(data);
        const token = jwt.sign(query, process.env.TOKEN_KEY, {
          expiresIn: "1h",
        });
        return res.send({ token, result });
      })
      
      //user get 
       app.get("/users", async (req, res) => {
         const email = req.query.email;
        //  const token = jwt.sign(email, process.env.TOKEN_KEY, {expiresIn:'1h'});
         const query = {email}
         const result = await UsersCollection.findOne(query);          
         if (result?.email) {
            const token = jwt.sign(query, process.env.TOKEN_KEY, {
              expiresIn: "1h",
            });
           return res.send({ token, result });
         }
         return res.sendStatus(403);
           
       });
      
      // Delete users 
      app.delete('/users/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await UsersCollection.deleteOne(query);
        res.send(result);
      })

      // verify seller
      app.put('/users', async (req, res) => {
        const id = req.query.id;
        const email = req.query.email;
        const query = { _id: ObjectId(id) };
        const query2 = { seller_email :email};
        const updateDoc = {
          $set: {
            user_verified: true
          }
        }
        const update = await BooksCollection.updateMany(query2, updateDoc, { upsert: true });
        const result = await UsersCollection.updateOne(query, updateDoc, { upsert: true });
        res.send(result);
      })
      
      
      // collect sold product 
      app.post("/buy", verifyToken, async (req, res) => {
        const token = req.decoded.email;
        // console.log(token);
        const data = req.body.buyProduct;
        const query = { _id: ObjectId(data?.ProductId) };
        const updateDoc = {
          $set: {
            sold: true,
            advertise:false,
          },
        };
        const product = await BooksCollection.updateOne(query, updateDoc, {
          upsert: true,
        });

        const result = await soldProductCollection.insertOne(data);
        res.send(result);
      });

      // get all my product 
      app.get('/buy', async (req, res) => {
        const email = req?.query.email;
        const query = { BuyerEmail: email };
        const result = await soldProductCollection.find(query).toArray();
        res.send(result)
      });

      //delete product 
      app.delete('/buy/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const product = await soldProductCollection.findOne(query);
        const query2 = { _id: ObjectId(product?.ProductId) };
        const updateDoc = {
          $set: {
            sold: false
          }
        }
        const update = await BooksCollection.updateOne(query2, updateDoc, { upsert: true })
        const result = await soldProductCollection.deleteOne(query);
        res.send(result);
      });

      // add product 
      app.post('/books', async (req, res) => {
        const data = req.body;
        const result = await BooksCollection.insertOne(data);
        res.send(result);
      });

      // get seller product data 
      app.get("/products", async (req, res) => {
        const email = req.query.email;
        const query = { seller_email: email };
        const result = await BooksCollection.find(query).toArray();
        res.send(result);
      });
      
      //get buyer information
      app.get('/buyer', async (req, res) => {
        const email = req.query.email;
        const query = { sellerEmail: email };
        const result = await soldProductCollection.find(query).toArray();
        res.send(result);
      });

      app.get('/users_type', async (req, res) => {
        const type = req.query.type;
        const query = { role: type };
        // console.log(query);
        const result = await UsersCollection.find(query).toArray();
        // console.log(result)
        res.send(result);
      });

      // advertise Products
      app.put('/advertise/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const updateDoc = {
          $set: {
            advertise: true
          }
        };
        const result = await BooksCollection.updateOne(query, updateDoc, { upsert: true });
        res.send(result);
      });

      // delete Product
      app.delete('/products/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await BooksCollection.deleteOne(query);
        res.send(result);
      });

      // advertised product
      app.get('/advertised', async (req, res) => {
        const query = { advertise: true };
        const result = await BooksCollection.find(query).toArray();
        res.send(result);
      });

      // add product to wishlist
      app.post('/wishlist', async (req, res) => {
        const data = req.body;
        const id = req.query.id;
        const email = req.query.email;
        // check data exist or not 
        const query = { ProductId: id, buyerEmail :email};
        const checkData = await WishlistCollection.findOne(query);
        console.log(checkData);
        if (checkData) {
           return res.send({message: 'This product is already in your wishlist'})
        }
        //post data
        const result = await WishlistCollection.insertOne(data);
          return res.send(result);
      })

      // get wishlist product 
      app.get('/wishlist', async (req, res) => {
        const email = req.query.email;
        const query = { buyerEmail: email };
        const result = await WishlistCollection.find(query).toArray();
        res.send(result);
      })
      
      // delete wishlist product
         app.delete("/wishlist/:id", async (req, res) => {
           const id = req.params.id;
           const query = { _id: ObjectId(id) };
           const result = await WishlistCollection.deleteOne(query);
           res.send(result);
         });

      // get single my product
      app.get('/myproduct/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: ObjectId(id) };
        const result = await soldProductCollection.findOne(query);
        res.send(result);
      })


      // payments
      app.post('/payment', async (req, res) => {
        const data = req.body.ProductPrice;
        // console.log(data * 100);
        const payment = await stripe.paymentIntents.create({
          amount: `${data*100}`,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: payment.client_secret,
        });
      })

      
      
    } 
    finally {
        
    }
}
run().catch(err => console.log(err));



app.listen(port, () => {
    console.log('server is running')
})

