var express = require('express');
var mysql = require('mysql2');
var bodyParser = require('body-parser');
const e = require('express');
var app = express();
app.use(bodyParser.json());
const axios = require('axios');

const serverless = require('serverless-http');

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



//App listening on PORT 3000
app.listen(3000);