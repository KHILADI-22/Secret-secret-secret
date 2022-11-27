require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
// const md5 = require("md5");
// const encrypt = require("mongoose-encryption");
// const bcrypt = require("bcrypt");
// const saltingRounds = 10;
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require('mongoose-findorcreate');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const allSecrets = [];

const app = express();
app.use(express.urlencoded({
  extended: true
}));
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(session({
  secret: "Ilovebeer",
  resave: true,
  userUninitialized: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGO_URI);
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

const secretSchema  = new mongoose.Schema({
  name : String,
  secret : String
}); 

const Secret = new mongoose.model("secret" , secretSchema);


userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
// userSchema.plugin(encrypt,{secret:process.env.SECRET},{encryptedFields:["password"]});
const User = new mongoose.model("user", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res) {
  res.render("home");
});

app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

app.get("/auth/google",
  passport.authenticate("google", {
    scope: ["profile"]
  }));

app.get("/auth/google/secrets",
  passport.authenticate("google", {
    failureRedirect: "/login"
  }),
  function(req, res) {
    res.redirect('/secrets');
  });

app.get("/secrets", function(req, res) {
  res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stal   e=0, post-check=0, pre-check=0');
  if (req.isAuthenticated()) {

    // console.log(allSecrets);
    if(allSecrets.length==0){
      Secret.find({} , function(err,secret){
        // console.log(secret.secret);
        secret.forEach(function(ele){
          // console.log(ele);
          allSecrets.push(ele.secret);
        })
      })
    }
    setTimeout(function(){res.render("secrets", {allSecrets: allSecrets})},1000);
    
    
  } else {
    res.redirect("/login");
  }
});

app.get("/submit", function(req, res) {
  res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stal   e=0, post-check=0, pre-check=0');
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/register", function(req, res) {
  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });

  // bcrypt.hash(req.body.password, saltingRounds, function(err,hash){
  //   const user = new User({
  //     email: req.body.username,
  //     password: hash
  //     // password: md5(req.body.password)
  //   });
  //   user.save(function(err){
  //     if(err){
  //       res.send(err);
  //     }
  //     else{
  //       res.render("secrets");
  //     }
  //   });
  // });

});



app.post("/login", passport.authenticate("local"), function(req, res) {
  res.redirect("/secrets");

  // User.findOne({email:req.body.username},function(err,user){
  //   if(err){
  //     res.send(err);
  //   }
  //   else{
  //     bcrypt.compare(req.body.password, user.password, function(err,result){
  //       if(result){
  //         res.render("secrets");
  //       }
  //       else{
  //         res.send(err);
  //       }
  //     });
  //     // if(md5(req.body.password)===user.password){
  //     //   res.render("secrets");
  //     // }
  //     // else{
  //     //   res.send("User not found!");
  //     // }
  //   }
  // });
});

app.post("/submit",function(req,res){
  User.findById(req.user._id, function(err,user){
    if(err){
      res.send(err);
    } else{
      if(user){
        user.secret = req.body.secret;
        allSecrets.push(req.body.secret);

        const temp = new Secret({
          name : req.user.username | req.user.googleId,
          secret : req.body.secret
        })
        temp.save();

        user.save(function(){
          res.redirect("/secrets");
        });
      }
    }
  });
});

app.listen(process.env.PORT||3000, function() {
  console.log("I am on!");
});
