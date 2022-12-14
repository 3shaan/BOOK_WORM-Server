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
        return res.status(403).send({message:'Please log in again'});
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
        const PaymentCollection = client.db('books-worm').collection('payment');
        const BlogsCollection = client.db('books-worm').collection('blogs');


        app.get("/category",async (req, res) => {
            const result = await categoriesCollection.find({}).toArray();
         res.send(result);
        });
      
      // get all books list 
      app.get('/allproducts', async (req, res) => {
        const result = await BooksCollection.find({}).toArray();
        res.send(result);
      })

        // get books by category

        app.get("/category/:books", async (req, res) => {
          const books = req.params.books;
          console.log(books)
          const query = { genre: books };
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
      
      //get users with google signup
      // I set different email and token so that if user log in again again with google , its doesn't add database multiple time 
      app.get('/google_user',async (req, res) => {
        const email = req.query.email;
        const query = { email };
         const token = jwt.sign(query, process.env.TOKEN_KEY, {
           expiresIn: "1h",
         });
        const result = await UsersCollection.findOne(query);
        res.send({ result, token });
      })
      
      // Delete users 
      app.delete('/users/:id',verifyToken, async (req, res) => {
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
      app.get('/buy',verifyToken, async (req, res) => {
        const email = req?.query.email;
        const query = { BuyerEmail: email };
        const result = await soldProductCollection.find(query).toArray();
        res.send(result)
      });

      //delete product 
      app.delete('/buy/:id',verifyToken, async (req, res) => {
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
      app.post('/books',verifyToken, async (req, res) => {
        const data = req.body;
        const result = await BooksCollection.insertOne(data);
        res.send(result);
      });

      // get seller product data 
      app.get("/products",verifyToken, async (req, res) => {
        const email = req.query.email;
        const query = { seller_email: email };
        const result = await BooksCollection.find(query).toArray();
        res.send(result);
      });
      
      //get buyer information
      app.get('/buyer',verifyToken, async (req, res) => {
        const email = req.query.email;
        const query = { sellerEmail: email };
        const result = await soldProductCollection.find(query).toArray();
        res.send(result);
      });

      app.get('/users_type',verifyToken, async (req, res) => {
        const type = req.query.type;
        const query = { role: type };
        // console.log(query);
        const result = await UsersCollection.find(query).toArray();
        // console.log(result)
        res.send(result);
      });

      // advertise Products
      app.put('/advertise/:id',verifyToken, async (req, res) => {
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
      app.delete('/products/:id',verifyToken, async (req, res) => {
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
      app.post('/wishlist',verifyToken, async (req, res) => {
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
      app.get('/wishlist',verifyToken, async (req, res) => {
        const email = req.query.email;
        const query = { buyerEmail: email };
        const result = await WishlistCollection.find(query).toArray();
        res.send(result);
      })
      
      // delete wishlist product
         app.delete("/wishlist/:id",verifyToken, async (req, res) => {
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

      //wishlist
      app.get('/wishlist_payment/:id', async (req, res) => {
        const id = req?.params?.id;
        const query = { _id: ObjectId(id) };
        const result = await WishlistCollection.findOne(query);
        res.send(result);
      })


      // payments
      app.post('/payments', async (req, res) => {
        const data = req.body.ProductPrice;
        const payment = await stripe.paymentIntents.create({
          amount: `${data * 100}`,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: payment.client_secret,
        });
      });

      // payment stored in database 
      app.post('/payment_success', verifyToken, async (req, res) => {
        const data = req.body;
        const ProductId = data.ProductId;
        const query = { _id: ObjectId(ProductId) };
        const query2 = { ProductId }
        const updateDoc = {
          $set: {
            payment: true
          }
        };
        const product = await BooksCollection.updateOne(query, updateDoc, { upsert: true });
        const soldProduct = await soldProductCollection.updateOne(query2, updateDoc, { upsert: true });

        const result = await PaymentCollection.insertOne(data);
        res.send(result);
      });

      /// blogs get 
      app.get('/blogs', async (req, res) => {
        const query = {};
        const result = await BlogsCollection.find(query).toArray();
        res.send(result);
      });
      
      
    } 
    finally {
        
    }
}
run().catch(err => console.log(err));



app.listen(port, () => {
  console.log('server is running')
});

