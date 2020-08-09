var express = require('express');
var mysql = require('mysql2');
var bodyParser = require('body-parser');
const e = require('express');
var app = express();
app.use(bodyParser.json());
const axios = require('axios');
const Joi = require('joi');
var passwordHash = require('password-hash');

const serverless = require('serverless-http');

 const MY_SELLER_URL = "http://ec2-54-226-69-59.compute-1.amazonaws.com:1337";
//const MY_SELLER_URL = "http://localhost:8080";
const MY_DELIVERY_URL = "http://ec2-18-212-133-17.compute-1.amazonaws.com:1337";

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
    var hashedPassword = passwordHash.generate(password);

    con.query("SELECT * FROM user WHERE emailid=? ", [emailid], (err, rows, fields) => {
        if (!err) {
            if (rows.length > 0) {

                console.log();
                if (passwordHash.verify(password, rows[0].password)) {
                    //  console.log(true);
                    res.status(200).send(rows);
                }
                else {
                    console.log("wrong")
                    res.status(412).send("Wrong Credentials");
                }

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



app.post('/OrderHistory', function (req, res) {

    console.log("called");
    var user_id = req.body.user_id;

    //checking if any value is null or not
    if (user_id === "" || !user_id) {
        res.status(412).send("please enter all the required input ");
    }
    con.query("SELECT * FROM Orders WHERE user_id=? ", [user_id], (err, rows, fields) => {
        if (!err) {

            res.status(200).send(rows);

        }
        else {
            console.log(err);
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
                var hashedPassword = passwordHash.generate(password);
                console.log(hashedPassword);
                //If emai-id does not exist thne store the user information
                con.query("insert into user(username,password,emailid,address) values(?,?,?,?)", [username, hashedPassword, emailid, address], (err, rows, fields) => {
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
    checkQtyFromSeller(req, res);



});

app.post('/order/commit', async function (req, res) {

    console.log(req.query);

    // const schema = Joi.object({
    //     perform: Joi.required(),
    //     tranId: Joi.required(),
    // });

    // const result = schema.validate(req.body);
    // if (result.error) {
    //     res.status(400).send(result.error.details[0].message);
    //     return;
    // }

    if (req.query.perform === 'true') {
        //perform commit with given id;
        let commit = await performXACommit(req.query.tranId, (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send("Error while executing XA COMMIT transaction.");
                return;
            } else {
                return;
            }
        });
    } else {
        //rollback with given id;
        let rollback = await performXARollback(req.query.tranId, (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send("Error while executing XA ROCKBACK transaction.");
                return;
            } else {
                return;
            }
        });
    }
    console.log("Transaction: " + req.query.tranId + " completed successfully!");
    res.status(200).send("Transaction: " + req.query.tranId + " completed successfully!");
});


//Async function to call the seller api and confirm that the ordered product's qty is available or not
async function checkQtyFromSeller(req, res) {

    let getMaxSQL = "insert into MaxTranId() value()";
    con.query(getMaxSQL, (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send("DB Error while adding orders.");
            return;
        } else {
            con.query("SELECT LAST_INSERT_ID()", async (err, rows) => {
                let tempID = rows[0]['LAST_INSERT_ID()'];
                console.log(tempID);

                let xaStart = await performXAStart(tempID, async (err, result) => {

                    if (err) {
                        console.log(err);
                        res.status(500).send("Error while executing XA START transaction.");
                    } else {
                        console.log("XA START executed.");
                        // let promise = await confirmQtyFromSeller(req, res);
                        let promise = true;
                        if (promise == true) {
                            console.log("MySeller has enough stock to place order.");
                            await storeOrderData(req, res, tempID);


                        } else {
                            let xaEnd = await performXAEnd(tempID, async (err, result) => {
                                if (err) {
                                    console.log(err);
                                    res.status(500).send("Error while executing XA END transaction.");
                                } else {
                                    let xaPrepare = await performXAPrepare(tempID, async (err, result) => {
                                        if (err) {
                                            console.log(err);
                                            res.status(500).send("Error while executing XA PREPARE transaction.");
                                        } else {
                                            let xaRollback = await performXARollback(tempID, async (err, result) => {

                                                if (err) {
                                                    console.log(err);
                                                    res.status(500).send("Error while executing XA ROLLBACK transaction.");
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    }
                });
            });
        }
    });

}

//Async function that calls the seller API to check the qty
async function confirmQtyFromSeller(req, res) {

    console.log('Calling the API seller company to check the Quantity of the selected product');
    try {
        let response = await axios.get(MY_SELLER_URL + '/products/get-product' + '?productId=' + req.body.productId,
            // {
            //     "seller_id": req.body.sellerId,
            //     "product_id": req.body.productId
            // }
        );
        if (response.status === 200) {
            if (response.data.qoh - req.body.orderQty >= 0) {
                return true;
            } else {
                return false;
            }
        }
    } catch (err) {
        console.log('Error while storing the  order data into the Seller company: ' + err);
        sendError(res, 'Error while storing the  order data into the Seller company: ' + err.response.data);
        return false;
    }
}

async function performXAStart(id, callback) {
    console.log("Executing XA START " + id + ".");
    //  con.query("XA START '"+ id +"';", (err, result) =>{
    //     if(err){
    //         console.log("Error while executing XA START "+ id + ", error: "+ err);
    //         return false;
    //     }
    //     console.log("Executed XA START "+ id + ".");
    //     return true;
    // });
    con.query("XA START '" + id + "';", callback);
}

async function performXAEnd(id, callback) {
    console.log("Executing XA END " + id + ".");
    con.query("XA END '" + id + "';", callback);
}

async function performXAPrepare(id, callback) {
    console.log("Executing XA PREPARE " + id + ".");
    con.query("XA PREPARE '" + id + "';", callback);
}

async function performXACommit(id, callback) {
    console.log("Executing XA COMMIT " + id + ".");
    con.query("XA COMMIT '" + id + "';", callback);
}

async function performXARollback(id, callback) {
    console.log("Executing XA ROLLBACK " + id + ".");
    con.query("XA ROLLBACK '" + id + "';", callback);
}

async function makePrepareForCommit(tranId) {

    let xaEnd = await performXAEnd(tranId, async (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send("Error while executing XA END transaction.");
        } else {
            let xaPrepare = await performXAPrepare(tranId, (err, result) => {
                if (err) {
                    console.log(err);
                    res.status(500).send("Error while executing XA PREPARE transaction.");
                } else {
                    return;
                }
            });
        }
    });
}

//If the qty is available then store the irder data into the MyKart's database.
async function storeOrderData(req, res, tranId) {


    console.log("Storing the user order data in to MyKart company's Database")
    let sql = `INSERT INTO Orders(user_id, seller_id, order_qty, product_id, user_address, order_total) VALUES (?, ?, ?, ?, ?, ?)`;

    con.query(sql, [req.body.userId, req.body.sellerId, req.body.orderQty, req.body.productId, req.body.userAdd, req.body.orderTotal], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send("DB Error while adding orders.");
            return;
        }
        else {
            //Getting the last Order_id
            con.query("select order_id from Orders where order_id=(SELECT LAST_INSERT_ID())", async (err, rows, fields) => {
                if (!err) {
                    //Getting the order_id
                    let order_id = rows[0].order_id;
                    console.log("user's OrderId is-->" + order_id)
                    //waiting for the delivery company's response (Calling them to store the order data)
                    let promise = await storeOrderDataInDeliverCompany(req, order_id, res, tranId);
                    if (promise == true) {
                        //Calling seller company to store the order data
                        storeOrderDataInSellerCompany(req, order_id, res, tranId);
                        res.status(200).send(req.body);
                    }

                    await makePrepareForCommit(tranId);
                }
                else {
                    console.log("Error while fetching order id: ", err);
                    res.status(500).send("Server error please try again later");
                }
            });
        }
    });
}
//Call the delivercompany API and send the order information(Storing the order data).
async function storeOrderDataInDeliverCompany(req, order_id, res, tranId) {
    console.log('Calling the API of Delivery company and storing the ordered details');
    try {
        let response = await axios.post(MY_DELIVERY_URL + '/delivery/order',
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
async function storeOrderDataInSellerCompany(req, order_id, res, tranId) {
    console.log('Calling the API of Seller company and storing the ordered details');
    try {
        let response = await axios.post(MY_SELLER_URL + '/products/order?tranId='+tranId,
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
        console.log('Error while storing the  order data into the Seller company: ' + err);
        sendError(res, 'Error while storing the  order data into the Seller company: ' + err.response.data);
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