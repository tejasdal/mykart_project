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

    console.log("called");
    var emailid = req.body.emailid;
    var password = req.body.password;

    //checking if any value is null or not
    if (emailid === "" || password === "" || !emailid || !password) {
        res.status(412).send("please enter all the required input ");
    }
    con.query("SELECT * FROM user WHERE emailid=? and password=?", [emailid, password], (err, rows, fields) => {
        if (!err) {
            if (rows.length > 0) {
              //  console.log(true);
                res.status(200).send(rows);
            }
            else {
                console.log("wrong")
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
                res.status(412).send("Email-Id exist in the Database");
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



//Storing the order information in the database
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

    //Calling async function to check the qty from the seller.
    checkQtyFromSeller(req);



});


//Async function to call the seller api and confirm that the ordered product's qty is available or not
async function checkQtyFromSeller(req) {
    let promise = await confirmQtyFromSeller(req);
    if (promise == true) {
        storeOrderData(req);
    }
}

//Async function that calls the seller API to check the qty
async function confirmQtyFromSeller(req) {

    console.log('Calling the API seller company to check the Quantity of the selected product');
    try {
        let response = await axios.get(MY_SELLER_URL + '/confirmQuantity',
            {
                "seller_id": req.body.sellerId,
                "product_id": req.body.productId
            });
        if (response.status === 200) {
            return true;
        }
    } catch (err) {
        console.log('Error while storing the  order data into the Delivery company: ' + err);
        sendError(res, 'Error while storing the  order data into the Delivery company: ' + err.response.data);
        return false;
    }
}


//If the qty is available then store the irder data into the MyKart's database.
async function storeOrderData(req) {


    console.log("Storing the user order data in to MyKArt company's Database")
    let sql = `INSERT INTO Orders(user_id, seller_id, order_qty, product_id, user_address, order_total) VALUES (?, ?, ?, ?, ?, ?)`;

    con.query(sql, [req.body.userId, req.body.sellerId, req.body.orderQty, req.body.productId, req.body.userAdd, req.body.orderTotal], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send("DB Error while adding orders.");
            return;
        }
        else {
            //Getting the last Order_id
            con.query("select order_id from orders where order_id=(SELECT LAST_INSERT_ID())", async (err, rows, fields) => {
                if (!err) {
                    //Getting the order_id
                    let order_id = rows[0].order_id;
                    console.log("user's OrderId is-->" + order_id)
                    //waiting for the delivery company's response (Calling them to store the order data)
                    let promise = await storeOrderDataInDeliverCompany(req, order_id);
                    if (promise == true) {
                        //Calling seller company to store the order data
                        storeOrderDataInSellerCompany(req, order_id);
                        res.status(200).send(req.body);
                    }
                }
                else {
                    res.status(500).send("Server error please try again later");
                }
            });
        }
    });
}
//Call the delivercompany API and send the order information(Storing the order data).
async function storeOrderDataInDeliverCompany(req, order_id) {
    console.log('Caaling the API of Delivery company and storing the ordered details');
    try {
        let response = await axios.get(MY_DELIVERY_URL + '/orderData',
            {
                "user_id": req.body.userId,
                "seller_id": req.body.sellerId,
                "order_qty": req.body.orderQty,
                "product_id": req.body.productId,
                "user_address": req.body.userAdd,
                "order_total": req.body.orderTotal,
                "order_id": order_id
            });
        if (response.status === 200) {
            return true;
        }
    } catch (err) {
        console.log('Error while storing the  order data into the Delivery company: ' + err);
        sendError(res, 'Error while storing the  order data into the Delivery company: ' + err.response.data);
        return false;
    }
}



//Call the Seller comapny API and send the order information(Storing the order data).
async function storeOrderDataInSellerCompany(req, order_id) {
    console.log('Caaling the API of Delivery company and storing the ordered details');
    try {
        let response = await axios.get(MY_SELLER_URL + '/orderData',
            {
                "user_id": req.body.userId,
                "seller_id": req.body.sellerId,
                "order_qty": req.body.orderQty,
                "product_id": req.body.productId,
                "user_address": req.body.userAdd,
                "order_total": req.body.orderTotal,
                "order_id": order_id
            });
        if (response.status === 200) {
            return true;
        }
    } catch (err) {
        console.log('Error while storing the  order data into the Delivery company: ' + err);
        sendError(res, 'Error while storing the  order data into the Delivery company: ' + err.response.data);
        return false;
    }
}



app.get('/temp', function (req, res) {
    let data = A(req);

})

async function A(params) {
    let data = await B(params);
    console.log(data)

}


async function B(params) {
    return false;
}

//App listening on PORT 3000
app.listen(3000);