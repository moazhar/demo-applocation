require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT;

const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const userRoute = require('./routes/users');

const http = require('http').Server(app);
const io = require('socket.io')(http);

// MongoDB connection
mongoose.connect(process.env.mongo_url,
    { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true}, () => {
    console.log('Connected to MongoDB');
});

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(morgan('common'));

io.on('connection', function (socket) {
    console.log('A user has connected');
});

// Register routes
app.use('/users', userRoute);

http.listen(port, () => {
    console.log(`Server started at port: ${port}`);
});
