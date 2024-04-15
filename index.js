const express = require('express')
const crypto = require('crypto');
const nodemailer = require("nodemailer");
const mg = require('nodemailer-mailgun-transport');
const { MongoClient, ServerApiVersion,ObjectId } = require('mongodb');
const app = express()
const SSLCommerzPayment = require('sslcommerz-lts')
const cors = require("cors");
const bcrypt = require("bcrypt");
require("dotenv").config();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());


//const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wqy4ji0.mongodb.net/?retryWrites=true&w=majority`;
const uri='mongodb://localhost:27017';
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const store_id = process.env.STORE_ID
const store_passwd = process.env.SOTRE_PASS
const is_live = false //true for live, false for sandbox

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("mysoftTask").collection("users");
    const productCollection = client.db("mysoftTask").collection("products");
    const cartCollection= client.db("mysoftTask").collection("carts");
    const checkoutCollection= client.db("mysoftTask").collection("checkout");
    const categoryCollection= client.db("mysoftTask").collection("categories");
    const wishListCollection= client.db("mysoftTask").collection("wishList");
    const forgetPassCollection = client.db("mysoftTask").collection("forgetPassword");

    app.post("/register", async (req, res) => {
        try {
            const userInfo = req.body;
            //console.log(userInfo);
            const query = { email: userInfo.email };
            const emailFilter = await userCollection.findOne(query);
            if (emailFilter) {
                res.status(400).json({ message: 'User already exists' })
                return;
            }
            const hashedPassword = await bcrypt.hash(userInfo.password, 10);
            const info ={
                name: userInfo.name,
                email: userInfo.email,
                phone: userInfo.phone,
                password: hashedPassword,
                role : userInfo.role,
                image: userInfo.image,
            }
            const result = await userCollection.insertOne(info);  
           res.send(result);
        } catch (error) {
            res.send(error);
        }
    });

    app.post("/login", async (req, res) => {
        try {
            const userInfo = req.body;
            const query = { email: userInfo.email };
            const user = await userCollection.findOne(query);
            if (!user) {
                res.status(400).json({ message: 'User not found' })
                return;
            }
            const passwordMatch = await bcrypt.compare(userInfo.password, user.password);
            if (!passwordMatch) {
                res.status(400).json({ message: 'Password not match' })
                return;
            }
            res.send(user);
        } catch (error) {
            res.send(error);  
        }
    });

    app.get("/users/:id", async (req, res) => {
        
        try {
            const id = req.params.id;
            const result = await userCollection.findOne({ _id:new ObjectId(id) });
            res.send(result);
        }
        catch (error) {
            res.send(error);
        }
    })

    app.patch("/users/passwordChange/:email", async (req, res) => {
        try {
            const email = req.params.email;
            const updatedPass = req.body;
            const query = { email: email };
           // console.log(updatedUser);
            const currentUser = await userCollection.findOne(query);
            if (!currentUser) {
                res.status(400).json({ message: 'User not found' })
                return;
            }
           if(updatedPass.password.length>0 && updatedPass.newPassword.length>0){
            const passwordMatch = await bcrypt.compare(updatedPass.password, currentUser.password);
            if (!passwordMatch) {
                res.status(400).json({ message: 'Password not match' })
                return;
            }
            const hashedPassword = await bcrypt.hash(updatedPass.newPassword, 10);
            const updatedPassword ={
                $set: {password: hashedPassword}
            }
            console.log(updatedPassword);
            const result = await userCollection.updateOne(query,updatedPassword);
            res.send(result);
           }else{
            res.status(400).json({ message: 'Password not match' })
            return;
           }
            
        } catch (error) {
            res.send(error);
        }
    });

    app.delete("/token/:email", async (req, res) => {
        const email = req.params.email;
        console.log(email);
        const query = { email: email };
        const result = await forgetPassCollection.deleteOne(query);
        res.send(result);
    })


    app.get("/forgetPassword/:email", async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        if (!user) {
            res.status(400).json({ message: 'User not found' })
            return;
        }
        
        const forgetToken = Math.floor(1000 + Math.random() * 9000); 
        
          // Configure your email provider's SMTP settings here
    const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email", // SMTP server hostname
        port: 587, // SMTP server port
        secure: false, // false for non-SSL; true for SSL/TLS
        auth: {
            user: 'bertha.reichert@ethereal.email',
            pass: 'GRmWQKVPrZfpqHmYmc'
        }
    });

    const mailOptions = {
        from: 'demu@example.com', // Sender's email address
        to: user.email, // Recipient's email address
        subject: "Password Reset Token",
        text: `Your password reset token is: ${forgetToken}`,
    };

    transporter.sendMail(mailOptions, async (error, info) => {
        if (error) {
            console.error("Error sending email:", error);
            res.status(500).json({ message: 'Email could not be sent' });
        } else {
            //console.log("Message sent: %s", info.messageId);
            const forgetPassInfo = {
                userId : user._id,
                email: user.email,
                token: forgetToken,
                date: new Date()

            }

        const result = await forgetPassCollection.insertOne(forgetPassInfo);
        res.send({info,user,result});
        }
    });

    })


    app.get("/forgetPasswordLink/:email", async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        if (!user) {
            res.status(400).json({ message: 'User not found' })
            return;
        }
        const tokenLengthInBytes = 32; // Change this to the desired length in bytes

        const randomBytes = crypto.randomBytes(tokenLengthInBytes).toString('hex');
        const auth = {
            auth: {
              api_key: 'key-50a567f263d7934c684535c58026fb2c',
              domain: 'sandboxdf0955608f984d86bb85ffb50753979a.mailgun.org'
            }
          }

          const nodemailerMailgun = nodemailer.createTransport(mg(auth));

            nodemailerMailgun.sendMail({
            from: 'prashoman.mysoftheaven@gmail.com',
            to: 'prashoman.mysoftheaven@gmail.com', // An array if you have multiple recipients.
            
            subject: 'Reset Password',
            
            //You can use "html:" to send HTML email content. It's magic!
            html: `<b>hellow ${user.name}</b>
            h1>Reset Password</h1>
            <p>Click <a href="http://localhost:5173/forgetPassword/${user.email}/${randomBytes}">here</a> to reset your password</p>`,
            //You can use "text:" to send plain-text content. It's oldschool!
            text: 'Mailgun rocks, pow pow!'
            }, (err, info) => {
            if (err) {
                console.log(`Error: ${err}`);
                res.send(err);
            }
            else {
                console.log(`Response: ${info}`);
                res.send({info,randomBytes});
            }
            });
    })


    app.get("/forgetPassword/:email/:token", async (req, res) => {
        const email = req.params.email;
        const token = parseInt(req.params.token) ;
       
        //console.log(email,token);
        const query = { email: email, token: token };
        const result = await forgetPassCollection.findOne(query);
        if (!result) {
            res.status(400).json({ message: 'Invalied Token found' })
            return;
        }

        const result1 = await forgetPassCollection.deleteOne(query);
        res.send(result1);
    })

    app.patch("/forgetPassword/:email", async (req, res) => {
        const email = req.params.email;
        const updatedUser = req.body;
        const query = { email: email };
        const currentUser = await userCollection.findOne(query);

        if (!currentUser) {
            res.status(400).json({ message: 'User not found' })
            return;
        }
       // console.log(updatedUser);
        const hashedPassword = await bcrypt.hash(updatedUser.password, 10);
        console.log(hashedPassword);
        const updatedPassword ={
            $set: {password: hashedPassword}
        }
        //currentUser.password = hashedPassword;
       

        const result = await userCollection.updateOne(query,updatedPassword);
        res.send(result);

    })

    //category

    app.post("/addCategory", async (req, res) => {
            
            try {
                const categoryInfo = req.body;
                //console.log(categoryInfo);
                const result = await categoryCollection.insertOne(categoryInfo);
                res.send(result);
            } catch (error) {
                res.send(error);
            }
    });

    app.get("/categories", async (req, res) => {
        try {
            const result = await categoryCollection.find({}).toArray();
            res.send(result);
        } catch (error) {
            res.send(error);
        }
    })

    app.get("/category/:categoryName", async (req, res) => {
        const categoryName = req.params.categoryName;
       // console.log(categoryName);
        const query = { productCategory: categoryName };
        const result = await productCollection.find(query).toArray();
        res.send(result);
    })



    ///product

    //indexing useing 

    // const result = await productCollection.createIndex({ productName: "text" });
    const indexKey = { productName: 1 };
const indexOptions = { name: "productName" };
const result = await productCollection.createIndex(indexKey, indexOptions);

///search by  productName, or category
app.get("/getProduct/:searchText", async (req, res) => {
  const searchText = req.params.searchText;

  const result = await productCollection
    .find({
      $or: [
        { productName: { $regex: searchText, $options: "i" } },
        { productCategory: { $regex: searchText, $options: "i" } }
      ]
    })
    .toArray();

  if (result.length > 0) {
    return res.send(result);
  } else {
    return res.send("No matching Products found.");
  }
});

    app.post("/addProduct", async (req, res) => {

        try {
            const productInfo = req.body;
             //console.log(productInfo);
            const result = await productCollection.insertOne(productInfo);
            res.send(result);
        } catch (error) {
            res.send(error);
        }
    });
    app.get("/products/:email", async (req, res) => {
        
        try {
            const email = req.params.email;
            const query = { email: email };
            const result = await productCollection.find(query).toArray();
            res.send(result);
        }
        catch (error) {
            res.send(error);
        }
    });
    app.get("/products", async (req, res) => {
        try {
            const result = await productCollection.find({}).toArray();
            res.send(result);
        } catch (error) {
            res.send(error);
        }
    });
    app.get("/product/:id", async (req, res) => {
        try {
            const id = req.params.id;
            const result = await productCollection.findOne({ _id:new ObjectId(id) });
            res.send(result);
        } catch (error) {
            res.send(error);
        }
    })
    app.patch("/products/:id", async (req, res) => {
        try {
            const id = req.params.id;
            const updatedProduct = req.body;
            console.log(updatedProduct);
            const result = await productCollection.updateOne(
                { _id:new ObjectId(id) },
                {
                    $set: updatedProduct,
                }
            );
            res.send(result);
        } catch (error) {
            res.send(error);
        }
    })
    app.delete("/products/:id", async (req, res) => {
        try {
            const id = req.params.id;
           // console.log(id);
            const result = await productCollection.deleteOne({ _id:new ObjectId(id) });
            res.send(result);
        } catch (error) {
            res.send(error);
        }
    })


    ///wishList 

    app.post("/addWishList", async (req, res) => {
                
                try {
                    const wishListInfo = req.body;
                    //console.log(wishListInfo);
                    const result = await wishListCollection.insertOne(wishListInfo);
                    res.send(result);
                } catch (error) {
                    res.send(error);
                }
    });

    app.get("/wishList/:email", async (req, res) => {
        const email = req.params.email;
        const query = {userEmail : email};
        const result = await wishListCollection.find(query).toArray();
        //console.log(result);

        let productAll = [];

        // Use a for...of loop instead of forEach
        for (const element of result) {
            const query = { _id: new ObjectId(element.productId) };
            const result2 = await productCollection.findOne(query);
            productAll.push(result2);
        }
        
        // console.log("all data", productAll);
        // console.log("result", result);
        res.send({result, productAll});
    })

    app.delete("/deleteWishList/:id", async (req, res) => {
        const id = req.params.id;
        //console.log(id);
        const result = await wishListCollection.deleteOne({ productId: id });
        res.send(result);
    })


    //cart

    // app.post("/addCart", async (req, res) => {
            
    //         try {
    //             const cartInfo = req.body;
    //             const result = await cartCollection.insertOne(cartInfo);
    //             res.send(result);
    //         } catch (error) {
    //             res.send(error);
    //         }
    // })

    // app.get("/cart/:email", async (req, res) => {
    //     try {
    //         const email = req.params.email;
    //        // console.log(email);
    //         const query = { user: email };
    //         const result = await cartCollection.find(query).toArray();
    //         res.send(result);
    //     } catch (error) {
    //         res.send(error);
    //     }
    // })

    // app.delete("/cart/:id", async (req,res)=>{
    //     const id = req.params.id;
    //     const query = { _id:new ObjectId(id) };
    //     const result = await cartCollection.deleteOne(query);
    //     res.send(result);
    // });


    //checkout

    app.post("/addCheckout", async (req, res) => {
                
       
            
        try {
            const checkoutInfo = req.body;
            // Extract product IDs from the checkoutInfo
            const productIds = checkoutInfo.product.map((item) => new ObjectId(item.productId));
          
            // Fetch the products from the productCollection using the extracted productIds
            const query = { _id: { $in: productIds } };
            const products = await productCollection.find(query).toArray();
          
            // Calculate the new quantities for each product and update them in the database
            const bulkOperations = products.map((product, index) => ({
              updateOne: {
                filter: { _id: product._id },
                update: { $inc: { productQuentity: -checkoutInfo.product[index].productQuentity } },
              },
            }));
          
            //const result2 = await productCollection.bulkWrite(bulkOperations);
            console.log(result2);
          
            // Now you can insert the checkoutInfo into the checkoutCollection if needed
            // const result = await checkoutCollection.insertOne(checkoutInfo);
          
            res.send({ result: "success", result2 });
          } catch (error) {
            console.error(error);
            res.status(500).send({ error: "Server error." });
          }
    })


    //ssl

    const tran_id = new ObjectId().toString() 
    app.post("/order", async (req,res)=>{

        const orderInfo = req.body;
        const data = {
            total_amount: orderInfo.totalPrice,
            currency: 'BDT',
            tran_id: tran_id, // use unique tran_id for each api call
            success_url: `http://localhost:5000/payment/success/${tran_id}`,
            fail_url: `http://localhost:5000/payment/fail/${tran_id}`,
            cancel_url: 'http://localhost:3030/cancel',
            ipn_url: 'http://localhost:3030/ipn',
            shipping_method: 'Courier',
            product_name: 'Computer.',
            product_category: 'Electronic',
            product_profile: 'general',
            cus_name: orderInfo.userName,
            cus_email: orderInfo.userEmail,
            cus_add1: orderInfo.address,
            cus_add2: 'Dhaka',
            cus_city: 'Dhaka',
            cus_state: 'Dhaka',
            cus_postcode: '1000',
            cus_country: 'Bangladesh',
            cus_phone: orderInfo.userPhone,
            cus_fax: '01711111111',
            ship_name: 'Customer Name',
            ship_add1: 'Dhaka',
            ship_add2: 'Dhaka',
            ship_city: 'Dhaka',
            ship_state: 'Dhaka',
            ship_postcode: orderInfo.postCode,
            ship_country: 'Bangladesh',
        };
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
        sslcz.init(data).then(apiResponse => {
            // Redirect the user to payment gateway
            let GatewayPageURL = apiResponse.GatewayPageURL
            res.send({url:GatewayPageURL});
            
            
            const orderData ={
                tranjectionId:tran_id,
                userName:orderInfo.userName,
                email:orderInfo.userEmail,
                paidStatus: false,
                phone:orderInfo.userPhone,
                postCode: orderInfo.postCode,
                address:orderInfo.address,
                product : orderInfo.product,
                totalPrice:orderInfo.totalPrice,
                paymentStatus:"pending",
                consfirmationStatus:"pending",
                date : new Date()
            }
            //console.log(orderData);
            const result =  checkoutCollection.insertOne(orderData);
            //console.log('Redirecting to: ', GatewayPageURL)
        });
       
    })


    app.post("/payment/success/:tranId", async(req, res) => {
        //console.log(req.params.tranId);
        const result1 = await checkoutCollection.findOne({ tranjectionId: req.params.tranId});
        //console.log(result1);
        result1.product.forEach( async(element) => {
            //console.log(element);
            const query = { _id: new ObjectId(element._id) };
            const result2 = await productCollection.findOne(query);
            //console.log(result2);
            const newQuantity = result2.productQuentity - element.productQuentity;
            const result3 = await productCollection.updateOne(query,
                {
                    $set: { productQuentity: newQuantity}
                });
            //console.log(result3);
        });
        const  result = await checkoutCollection.updateOne({
            tranjectionId: req.params.tranId
        },
        {
            $set: {
                paidStatus : true,
            }
        })
        if(result.modifiedCount > 0){
            res.redirect(`http://localhost:5173/payment/success/${req.params.tranId}`)
        }
    })

    app.post("/payment/fail/:tranId", async(req, res) => {
        //console.log(req.params.tranId);
        const  result = await checkoutCollection.deleteOne({tranjectionId: req.params.tranId})
        if(result.deletedCount > 0){
            res.redirect(`http://localhost:5173/payment/fail/${req.params.tranId}`)
        }
    })


    app.get("/myOrder/:email", async(req, res) => {
        const result = await checkoutCollection.find({
            $and: [
              { email: req.params.email },
              { paidStatus: true }
            ]
          }).toArray();
        res.send(result);
    })

    app.get("/allOrder", async(req, res) =>{
        const result = await checkoutCollection.find({paidStatus: true}).toArray();
        res.send(result);
    })

    app.patch("/updateOrder/:id", async(req, res) => {
        const result = await checkoutCollection.updateOne({_id: new ObjectId(req.params.id)},{
            $set: {
                paymentStatus: 'delivered'
            }
        });
        res.send(result);
    })

    app.post("/updateOrder/:id", async(req, res) => {
        const id = req.params.id;
       // console.log(id);
        const result = await checkoutCollection.findOne({_id: new ObjectId(id)});
//console.log(result);
        const totalPrice = result.product.reduce((total, item) => total + (item.newPrice * item.productQuentity), 0);
//console.log(result);
        const auth = {
            auth: {
              api_key: 'key-50a567f263d7934c684535c58026fb2c',
              domain: 'sandboxdf0955608f984d86bb85ffb50753979a.mailgun.org'
            }
          }

          const nodemailerMailgun = nodemailer.createTransport(mg(auth));

            nodemailerMailgun.sendMail({
            from: 'prashoman.mysoftheaven@gmail.com',
            to: 'prashoman.mysoftheaven@gmail.com', // An array if you have multiple recipients.
            
            subject: 'Order Confirmation',
            
            //You can use "html:" to send HTML email content. It's magic!
            html: `<b>Hi ${result.userName}</b>
            <h1>Your order # ${result.tranjectionId} has been placed successfully and we will let you know once your package is on its way.</h1>
            <h4>Thank you for shopping with us!</h4>
            
            <h1>Delivery Details</h1>
            <h4>Name : ${result.userName}</h4>
            <h4>Address : ${result.address}</h4>
            <h4>Phone : ${result.phone}</h4>
            <h4>Email : ${result.email}</h4>

            <div>
            <h1>Order Details</h1>

            <table>
            <thead>
              <tr>
                <th>SI</th>
                <th>Product Image</th>
                <th>Product Title</th>
                <th>Product Quentity</th>
                <th>Product Price</th>
                <th>Product Total Price</th>

              </tr>
            </thead>
            <tbody>
              ${result?.product?.map((item, index) => (
                `<tr>
                <th>${index + 1}</th>
                <td>
                    <img src="${item?.productImage}" alt="Product Image" width="50px" height="50px" onerror="this.src='placeholder-image.png'; this.alt='Image Not Found';" />
                </td>
                <td>${item?.productName}</td>
                <td>${item?.productQuentity}</td>
                <td>${item?.newPrice}</td>
                <td>${item?.productQuentity * item?.newPrice}</td>
              </tr>`
              ))}
            </tbody>
            </table>
             <hr/>
                <h3>Total Price : ${totalPrice}</h3>
            </div>

            `,
            //You can use "text:" to send plain-text content. It's oldschool!
            text: 'Mailgun rocks, pow pow!'
            }, async(err, info) => {
            if (err) {
                console.log(`Error: ${err}`);
                res.send(err);
            }
            else {
                const result2 = await checkoutCollection.updateOne({_id: new ObjectId(id)},{
                    $set: {
                        consfirmationStatus: 'confirmed'
                    }
                })
                console.log(`Response: ${info}`);
                res.send({info,result2});
            }
            });

    })

    app.get("/deliverdOrder", async(req,res)=>{
        const result = await checkoutCollection.find({$and: [
            { paymentStatus: 'delivered' },
            { paidStatus: true }
          ]}).toArray();
        res.send(result);
    })

    app.get("/pandingOrder", async(req,res)=>{
        const result = await checkoutCollection.find({$and: [
            { paymentStatus: 'pending' },
            { paidStatus: true }
          ]}).toArray();
        res.send(result);
    })

   


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})