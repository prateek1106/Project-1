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
  orderIdCounter: Number,
  users: [ {
    username: String,
    name: String
  } ],
  items: [ {
    username: String,
    itemName: String,
    itemQuantity: Number,
    orderid: Number,
    status: {
      color: String,
      username: String
    }
  }]
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);
const Room = new mongoose.model("Room", roomSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.get("/", function(req, res){
  if (req.isAuthenticated()){
    res.render("home", {auth: "1" , name: req.user.name} );
  } else{
    res.render("home", {auth: "0"} );
  }
});

app.get("/signup", function(req, res){
  if (req.isAuthenticated()){
    res.redirect("/");
  } else{
    res.render("signup");
  }
});

app.get("/profile", function(req, res){
  if (req.isAuthenticated()){
    res.render("profile", {username: req.user.username, name: req.user.name, rooms: req.user.rooms });
  } else {
    res.redirect("/");
  }
});

app.get("/room", function(req,res){
  if (req.isAuthenticated()){
    res.render("profile", {username: req.user.username, name: req.user.name, rooms: req.user.rooms });
  } else {
    res.redirect("/");
  }
});

app.get("/createRoom", function(req,res){
  if (req.isAuthenticated()){
    res.render("createRoom", {username: req.user.username, name: req.user.name});
  } else {
    res.redirect("/");
  }
});

app.get("/joinRoom", function(req,res){
  if (req.isAuthenticated()){
    res.render("joinRoom", {username: req.user.username, name: req.user.name});
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
      roomName: req.body.roomName,
      orderIdCounter: 1
    });
    newRoom.save(function(err){
      if (err) {
        console.log(err);
      } else {

        var users,items;
        //pushing username and name into the room object just created
        Room.find( { roomid: req.body.roomid } , function(err,room){
          if(err){
            console.log(err);
          }
          else{
            room[0].users.push({ username: req.body.userName , name: req.body.name });
            room[0].save();
            users=room[0].users;
            items=room[0].items;

            res.render("room", {roomName: req.body.roomName, name: req.body.name, users: users,
              username: req.body.userName, roomid: req.body.roomid, items: items});
          }
        });
      }
    });
  });

});

app.post("/join", function(req,res){

  const roomid = req.body.roomid;
  const password = req.body.password;
  var users,items;

  User.find( { username: req.body.userName ,"rooms.roomid" : req.body.roomid } , function(err,user){
    if(err){
      console.log(err);
    }
    else{

      if(user.length===0)
      {
        //pushing roomid and roomName into the user object which was being used
        User.find( { username: req.body.userName } , function(err,users){
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
                users[0].rooms.push({ roomid: req.body.roomid , roomName: roomname });
                users[0].save();
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
            items=room[0].items;
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
            items=room[0].items;
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
          res.render("room", {roomName: foundRoom.roomName, name: req.body.name, users: users,
             username: req.body.userName, roomid: req.body.roomid, items: items});
        }
        bcrypt.compare(password, foundRoom.password, function(err, result) {
          if (result === true) {
            res.render("room",  {roomName: foundRoom.roomName, name: req.body.name, users: users,
               username: req.body.userName, roomid: req.body.roomid, items: items});
          }
        });
      }
    }
  });
});

app.post("/add", function(req,res){

  var users,items;
  Room.findOne( { roomid: req.body.roomid } , function(err,room){
    if(err){console.log(err);}
    else{
      room.items.push({ username: req.user.username ,
                        itemName: req.body.itemName,
                        itemQuantity: req.body.itemQuantity,
                        orderid: room.orderIdCounter,
                        status: {
                          color: "red",
                        }});
      room.save();
      room.orderIdCounter=room.orderIdCounter+1;

      users=room.users;
      items=room.items;

      res.render("room",  {roomName: req.body.roomName, name: req.user.name, users: users,
         username: req.user.userName, roomid: req.body.roomid, items: items});
    }
  });
});

app.post("/delete-room",function(req,res){

  var total_items,items=[];
  Room.find( { roomid: req.body.roomid } , function(err,room){
    if(err){console.log(err);}
    else{
      total_items=room[0].items;
      for(var i=0;i<total_items.length;i++)
      {
        if(total_items[i].username===req.user.username)
        {
          items.push(total_items[i]);
        }
      }

      res.render("deleteRoom",  {roomName: req.body.roomName, name: req.user.name,
        username: req.user.username, roomid: req.body.roomid, items: items} );
    }
  });

});

app.post("/delete",function(req,res){
  //console.log(req.body.itemID);

  Room.find( { roomid: req.body.roomid }, function(err,room){
    if(err){console.log(err);}
    else{
      room[0].items.pull({ _id: req.body.itemID });
      room[0].save();

      var total_items,items=[];
      total_items=room[0].items;
      for(var i=0;i<total_items.length;i++)
      {
        if(total_items[i].username===req.user.username)
        {
          items.push(total_items[i]);
        }
      }

      res.render("deleteRoom",  {roomName: req.body.roomName, name: req.user.name,
        username: req.user.username, roomid: req.body.roomid, items: items} );
    }

  });

});

app.post("/done-delete",function(req,res){

  var users,items;
  Room.find( { roomid: req.body.roomid }, function(err,room){
    if(err){console.log(err);}
    else{
      users=room[0].users;
      items=room[0].items;
      res.render("room",  {roomName: req.body.roomName, name: req.user.name, users: users,
         username: req.user.userName, roomid: req.body.roomid, items: items});
    }
  });
});

app.post("/buy-room",function(req,res){

  var total_items,items=[];
  Room.find( { roomid: req.body.roomid } , function(err,room){
    if(err){console.log(err);}
    else{
      total_items=room[0].items;
      for(var i=0;i<total_items.length;i++)
      {
        if(total_items[i].status.color==="red")
        {
          items.push(total_items[i]);
        }
      }

      res.render("buyRoom",  {roomName: req.body.roomName, name: req.user.name,
        username: req.user.username, roomid: req.body.roomid, items: items} );
    }
  });

});

app.post("/buy",function(req,res){

  Room.find( { roomid: req.body.roomid }, function(err,room){
    if(err){console.log(err);}
    else{
      for(var i=0; i<room[0].items.length; i++)
      {if(room[0].items[i]._id == req.body.itemID)
        {
          room[0].items[i].status.color="green";
          room[0].items[i].status.username=req.user.username;
        }
      }
      room[0].save();

      var total_items,items=[];
      total_items=room[0].items;
      for(var i=0;i<total_items.length;i++)
      {
        if(total_items[i].status.color==="red")
        {
          items.push(total_items[i]);
        }
      }

      res.render("buyRoom",  {roomName: req.body.roomName, name: req.user.name,
        username: req.user.username, roomid: req.body.roomid, items: items} );
    }

  });

});

app.post("/done-buy",function(req,res){

  var users,items;
  Room.find( { roomid: req.body.roomid }, function(err,room){
    if(err){console.log(err);}
    else{
      users=room[0].users;
      items=room[0].items;
      res.render("room",  {roomName: req.body.roomName, name: req.user.name, users: users,
         username: req.user.userName, roomid: req.body.roomid, items: items});
    }
  });
});



app.listen(3000, function() {
  console.log("Server started on port 3000.");
});
