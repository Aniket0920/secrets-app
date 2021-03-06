require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended:true}));


app.use(passport.initialize());
app.use(passport.session());

//const url = process.env.MONGO_URL;

mongoose.connect("mongodb://localhost:27017/userDB",
{
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  googleId: String,
  facebookId: String,
  secrets: Array
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://arcane-sierra-75722.herokuapp.com/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id, email: profile.emails[0].value, username: profile.displayName }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: "https://arcane-sierra-75722.herokuapp.com/auth/facebook/secrets",
    profileFields: ['id', 'displayName', 'email']
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ facebookId: profile.id, email: profile.emails[0].value, username:profile.displayName }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res) {
    res.render("home");
});

app.get("/auth/google",
  passport.authenticate("google", {scope: ["profile", "email"] })
);

app.get("/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect("/secrets");
  });

app.get("/auth/facebook",
  passport.authenticate("facebook", {scope: ["email"] })
);

app.get("/auth/facebook/secrets",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect("/secrets");
  });

app.get("/login", function(req, res) {
    res.render("login");
});

app.get("/register", function(req, res) {
    res.render("register");
});

app.get("/secrets", function(req, res) {
  res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stal   e=0, post-check=0, pre-check=0');

  if(req.isAuthenticated()) {
    User.find({"secrets": {$ne: null}}, function(err, foundUsers) {
      if(err) {
        console.log(err);
      } else {
        if(foundUsers) {
          res.render("secrets", {usersWithSecrets: foundUsers});
        }
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/submit", function(req, res) {
  if(req.isAuthenticated()) {
    User.findById(req.user.id, function (err, foundUser){
      if(!err){
        res.render("submit", {secrets: foundUser.secrets});
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", function(req, res) {
  const submittedSecret = req.body.secret;

  User.findById(req.user.id, function(err, foundUser) {
    if(err) {
      console.log(err);
    } else {
      if(foundUser) {
        foundUser.secrets.push(submittedSecret);
        foundUser.save(function() {
          res.redirect("/secrets");
        });
      }
    }
  });
});

app.post("/submit/delete",function (req, res){
  if(req.isAuthenticated()){
    User.findById(req.user.id, function (err,foundUser){
      foundUser.secrets.splice(foundUser.secrets.indexOf(req.body.secret),1);
      foundUser.save(function (err) {
        if(!err){
          res.redirect("/secrets");
        }
      });
    });
  }else {
    res.redirect("/login");
  }
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

app.post("/register", function(req, res) {
  User.register({username: req.body.username}, req.body.password, function(err, user) {
    if(err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });
});

app.post("/login", function(req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err) {
        if(err) {
            console.log(err);
        } else {
          passport.authenticate("local")(req, res, function() {
            res.redirect("/secrets");
          });
        }
    });
});

let port = process.env.PORT;
if(port == null || port == "") {
  port = 3000;
}

app.listen(port, function() {
    console.log("Server Started successfully...");
});
