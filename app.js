//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "hello world.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema ({
  username: String,
  password: String,
  name: String,
  rooms: [ {
    roomid: String,
    roomName: String
  } ]
});

const roomSchema = new mongoose.Schema ({
  roomid: String,
  password: String,
  roomName: String,
  users: [ {
    username: String,
    name: String
  } ],
  items: [ {
    username: String,
    itemName: String,
    itemQuantity: String
  }]
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);
const Room = new mongoose.model("Room", roomSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.get("/", function(req, res){
  res.render("home");
});

app.get("/signup", function(req, res){
  res.render("signup");
});

app.get("/profile", function(req, res){
  if (req.isAuthenticated()){
    res.render("profile");
  } else {
    res.redirect("/");
  }
});

app.get("/room", function(req,res){
  if (req.isAuthenticated()){
    res.render("profile");
  } else {
    res.redirect("/");
  }
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});

app.post("/signup", function(req, res){

  var name=req.body.name;
  var username=req.body.username;
  var rooms;

  User.register({username: req.body.username, name: req.body.name }, req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/signup");
    } else {
        passport.authenticate("local")(req, res, function(){

        User.find( { username: req.body.username } , function(err,users){
            if(err){console.log(err);}
            else{
              rooms=users[0].rooms;
              //console.log(rooms);
            }
        });

        res.render("profile", {name : name, username: username, rooms: rooms});
      });
    }
  });

});

app.post("/login", function(req, res){

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  var name,username,rooms;

  User.find( { username: req.body.username } , function(err,users){
    if(err){
      console.log(err);
    }
    else{
      name=users[0].name;
      username=users[0].username;
    }
  });

  User.find( { username: req.body.username } , function(err,users){
    if(err){console.log(err);}
    else{
      rooms=users[0].rooms;
      //console.log(rooms);
    }
  });


  req.login(user, function(err){
    if (err) {
      console.log(err);
      res.redirect("/");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.render("profile", {name : name, username: username, rooms: rooms} );
      });
    }
  });

});

app.post("/create", function(req,res){

  //pushing roomid and roomName into the user object which was being used
  User.find( { username: req.body.userName } , function(err,user){
    if(err){
      console.log(err);
    }
    else{
      user[0].rooms.push({ roomid: req.body.roomid , roomName: req.body.roomName });
      user[0].save();
    }
  });

  bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
    const newRoom =  new Room({
      roomid: req.body.roomid,
      password: hash,
      roomName: req.body.roomName
    });
    newRoom.save(function(err){
      if (err) {
        console.log(err);
      } else {

        var users;
        //pushing username and name into the room object just created
        Room.find( { roomid: req.body.roomid } , function(err,room){
          if(err){
            console.log(err);
          }
          else{
            room[0].users.push({ username: req.body.userName , name: req.body.name });
            room[0].save();
            users=room[0].users;
          }
        });

        res.render("room", {roomName: req.body.roomName, name: req.body.name, users: users});
      }
    });
  });

});

app.post("/join", function(req,res){

  const roomid = req.body.roomid;
  const password = req.body.password;
  var users;
  //console.log(req.body.userName);
  //console.log(req.body.name);

  User.find( { username: req.body.userName ,"rooms.roomid" : req.body.roomid } , function(err,user){
    if(err){
      console.log(err);
    }
    else{
      //console.log(user[0]);
      if(user.length==0)
      {
        //console.log("push");
        //console.log(user[0]);

        //pushing roomid and roomName into the user object which was being used
        User.find( { username: req.body.userName } , function(err,user){
          if(err){
            console.log(err);
          }
          else{
            //finding roomname and then adding it
            var roomname;
            Room.find( { roomid: req.body.roomid } , function(err,room){
              if(err){console.log(err);}
              else{
                roomname=room[0].roomName;
                user[0].rooms.push({ roomid: req.body.roomid , roomName: roomname });
                user[0].save();
              }
            });
          }
        });

        Room.find( { roomid: req.body.roomid } , function(err,room){
          if(err){
            console.log(err);
          }
          else{
            room[0].users.push({ username: req.body.userName , name: req.body.name });
            room[0].save();
            users=room[0].users;
          }
        });

      }
      else{
        Room.find( { roomid: req.body.roomid } , function(err,room){
          if(err){
            console.log(err);
          }
          else{
            users=room[0].users;
          }
        });
      }
    }
  });



  Room.findOne({roomid: roomid}, function(err, foundRoom){
    if (err) {
      console.log(err);
    } else {
      if (foundRoom) {
        if (foundRoom.password === password) {
          res.render("room", {roomName: foundRoom.roomName, name: req.body.name, users: users});
        }
        bcrypt.compare(password, foundRoom.password, function(err, result) {
          if (result === true) {
            res.render("room",  {roomName: foundRoom.roomName, name: req.body.name, users: users});
          }
        });
      }
    }
  });

});






app.listen(3000, function() {
  console.log("Server started on port 3000.");
});
