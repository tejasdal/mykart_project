var express = require('express');
var mysql = require('mysql2');
var bodyParser = require('body-parser');
const e = require('express');
var app = express();
app.use(bodyParser.json());
const axios = require('axios');
const Joi = require('joi');

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
con.connect(function (err) {
    if (err) throw err;
    console.log("Database is successfully Connected!");
});


//User validation (Will be used when the user wants to place the order)
app.post('/login', function (req, res) {
    var emailid = req.body.emailid;
    var password = req.body.password;

    //checking if any value is null or not
    if (emailid === "" || password === "" || !emailid || !password) {
        res917.status(412).send("please enter all the required input ");
    }
    con.query("SELECT * FROM user WHERE emailid=? and password=?", [emailid, password], (err, rows, fields) => {
        if (!err) {
            if (rows.length > 0) {
                res.status(200).send("Your login is successfull!!");
            }
            else {
                res.status(412).send("Wrong Credentials");
            }
        }
        else {
            res.status(500).send("Server error please try again later");
        }
    });
});



app.post('/register', function (req, res) {
    var emailid = req.body.emailid;
    var password = req.body.password;
    var address = req.body.address;
    var username = req.body.username;

    console.log(username)
    //checking if any value is null or not
    if (emailid === "" || password === "" || address === "" || username === "" || !username || !address || !emailid || !password) {
        res917.status(412).send("please enter all the required input ");
    }
    //Checking if email-id exist in the database or not
    con.query("SELECT * FROM user WHERE emailid=? ", [emailid], (err, rows, fields) => {
        if (!err) {
            if (rows.length > 0) {
                res.status(512).send("Email-Id exist in the Database");
            }
            else {

                //If emai-id does not exist thne store the user information
                con.query("insert into user(username,password,emailid,address) values(?,?,?,?)", [username, password, emailid, address], (err, rows, fields) => {
                    if (!err) {
                        res.status(200).send("Your Registration is successfull!!");
                    }
                    else {
                        console.log(err)
                        res.status(500).send("Server error please try again later");
                    }
                });
            }
        }
        else {
            res.status(500).send("Server error please try again later");
        }
    });
});

//Fetch products from MySeller
app.get('/products', function (req, res) {

    return getProductsFromMySeller(res);
});

app.post('/order', function (req, res) {

    const schema = Joi.object({
        userId: Joi.number().required(),
        sellerId: Joi.number().required(),
        orderQty: Joi.number().min(1).required(),
        productId: Joi.number().required(),
        userAdd: Joi.string().required(),
        orderTotal: Joi.number().required(),
    });

    const result = schema.validate(req.body);
    if (result.error) {
        res.status(400).send(result.error.details[0].message);
        return;
    }

    let sql = `INSERT INTO Orders(user_id, seller_id, order_qty, product_id, user_address, order_total) VALUES (?, ?, ?, ?, ?, ?)`;

    con.query(sql, [req.body.userId, req.body.sellerId, req.body.orderQty, req.body.productId, req.body.userAdd, req.body.orderTotal], (err,result) =>{
        if(err){
            console.log(err);
            res.status(500).send("DB Error while adding orders.");
            return;
        }
        res.status(200).send(req.body);
    });


});

async function getProductsFromMySeller(res) {

    console.log('Fetching parts list from My Seller.');
    try {
        let response = await axios.get(MY_SELLER_URL + '/products/get-all-products');
        if (response.status === 200) {

            res.send(response.data);
            return;
        }
    } catch (err) {
        console.log('Error while fetching products from My Seller, error: ' + err);
        sendError(res, 'Error while fetching products from My Seller: ' + err.response.data);
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