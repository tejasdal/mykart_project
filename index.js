var express = require('express');
var mysql = require('mysql2');
var bodyParser = require('body-parser');
const e = require('express');
var app = express();
app.use(bodyParser.json());
const axios = require('axios');

const serverless = require('serverless-http');

const MY_SELLER_URL = "http://192.168.0.12:1337";
const MY_DELIVERY_URL = "";

//database connection
var con = mysql.createConnection({
    host: "assignment4.ckyqzu90h1yu.us-east-1.rds.amazonaws.com",
    user: "root",
    password: "shreeji2017",
    database: "Final_project"
   });
   //Ensuring the connection with database
   con.connect(function(err) {
    if (err) throw err;
    console.log("Database is successfully Connected!");
    });


//User validation (Will be used when the user wants to place the order)
app.post('/login', function (req, res) {
    var emailid=req.body.emailid;
    var password=req.body.password;

    con.query("SELECT * FROM user WHERE emailid=? and password=?",[emailid,password], (err, rows, fields) => {
        if (!err) {
            if (rows.length > 0) {
            res.status(200).send("Your login is successfull!!");
            }
            else{
                res.status(412).send("Wrong Credentials");
            }
        }
        else {
            res.status(500).send("Server error please try again later");
        }
    });
});


//Fetch products from MySeller
app.get('/products', function(req, res){

    return getProductsFromMySeller(res);
});

app.post('/order', function(req, res){

    
});

async function getProductsFromMySeller(res) {

    console.log('Fetching parts list from My Seller.');
    try {
      let response = await axios.get( MY_SELLER_URL+'/products/get-all-products');
      if (response.status === 200) {

        res.send(response.data);
        return;
      }
    } catch (err) {
      console.log('Error while fetching products from My Seller, error: ' + err);
      sendError(res,'Error while fetching products from My Seller: ' + err.response.data);
      return null;
    }
  }

  function sendError(res, message) {
    res.status(500).send({
      message: message
    });
  }

//App listening on PORT 3000
app.listen(3000);