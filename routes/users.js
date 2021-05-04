const express = require('express');
const userRouter = express.Router();

const bcrypt = require('bcryptjs');
const _ = require('lodash');

const Users = require('../models/user');
const upload = require('../services/file-upload');
const redis = require('../database/redis');
const { generateHashPassword } = require('../services/util');
const { authenticate, validatePassword } = require('../middleware/authenticate');


const singleUpload = upload.single('image');

// API to register a user
userRouter.post('/signup',
    validatePassword,
    async (req, res) => {
    const { name, username, password } = req.body;

    res.setHeader('Content-Type', 'application/json');
    try {
        if (!username || !password || !name) {
            return res.status(400).send({
                errorCode: 400,
                errorMessage: `Not all required fields are passed(username, password, name)`
            });
        }
        // Check if user exists in db if yes? throw Error 409 
        const result = await Users.find({ username: username });
        if (result.length > 0) {
            return res.status(409).send({
                errorCode: 409,
                errorMessage: `Conflicting username: ${username}`
            })
        }
        // Hash the password
        const hashPassword = await generateHashPassword(password);

        const user = new Users({
            name,
            username,
            password: hashPassword
        });
        // Generate token for a new user
        const token = await user.generateAuthToken();
        console.log(token);

        // Save generated token in a client side using cookie
        res.cookie('jwt_token', token, {
            expires: new Date(Date.now() + 5000),
            httpOnly: true
        });

        // Save user details
        await user.save();

        return res.status(201).send(_.pick(user, ['username', '_id']));
    } catch (ex) {
        res.status(500).send({
            errorCode: 500,
            errorMessage: `Internal Server Error! ${ex}`
        });
    }
});

// API to log in a user
userRouter.post('/login', async (req, res) => {
    const { username, password } = req.body;

    res.setHeader('Content-Type', 'application/json');

    if (!username || !password) {
        return res.status(400).send({
            errorCode: 400,
            errorMessage: `Missing fields(username/password)`
        });
    }
    try {
        const user = await Users.findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            // Generate token for incoming user
            const token = await user.generateAuthToken();
            console.log(token);

            // Save generated token in a client side using cookie
            res.cookie('jwt_token', token, {
                expires: new Date(Date.now() + 500000),
                httpOnly: true
            });

            console.log(`User Authenticated Successfully`);
            return res.status(200).send();
        } else {
            return res.status(400).send({
                errorCode: 400,
                errorMessage: `Invalid username/password`
            });
        }
    } catch (ex) {
        res.status(500).send({
            errorCode: 500,
            errorMessage: `Internal Server Error! ${ex}`
        });
    }
});

// API to follow a particular user
userRouter.put('/:id/follow',
    authenticate,
    async (req, res) => {
        if (req.headers.userId !== req.params.id) {
            try {
                const user = await Users.findById(req.params.id); // following user id
                const currentUser = await Users.findById(req.headers.userid); // follower user id
                if (!user.followers.includes(req.headers.userId)) {
                    await user.updateOne({ $push: { followers: req.headers.userid } });
                    await currentUser.updateOne({ $push: { following: req.params.id } });

                    res.status(204).send();
                } else {
                    return res.status(403).send();
                }
            } catch (ex) {
                res.status(500).send({
                    errorCode: 500,
                    errorMessage: `Internal Server Error! ${ex}`
                });
            }
        } else {
            return res.status(403).send();
        }
    });

// API to unfollow a particular user
userRouter.put('/:id/unfollow',
    authenticate,
    async (req, res) => {
        if (req.headers.userid !== req.params.id) {
            try {
                const user = await Users.findById(req.params.id); // following user id
                const currentUser = await Users.findById(req.headers.userid); // follower user id
                if (user.followers.includes(req.headers.userid)) {
                    await user.updateOne({ $pull: { followers: req.headers.userid } });
                    await currentUser.updateOne({ $pull: { following: req.params.id } });

                    res.status(204).send();
                } else {
                    res.status(403).send();
                }
            } catch (ex) {
                res.status(500).send({
                    errorCode: 500,
                    errorMessage: `Internal Server Error! ${ex}`
                });
            }
        } else {
            res.status(403).send();
        }
    });

// API to allow a user to post something
userRouter.post('/:id/posts',
    authenticate,
    singleUpload,
    async (req, res) => {
        const userid = req.params.id;
        const imageUrl = req.file.location;

        res.setHeader('Content-Type', 'application/json');
        try {
            const user = await Users.findById(userid);
            if (!user) {
                return res.status(400).send({
                    errorCode: 400,
                    errorMessage: `Invalid user: ${userid}`
                });
            }
            await user.updateOne({ $push: { posts: imageUrl } });

            const followers = user.followers;

            if (followers.length > 0) {
                // add this post in the feed of every follower of this user
                followers.forEach((follower) => {
                    // call set function of redis with key: follower, value: imageURL
                    redis.postData(follower, imageUrl).then((data) => {
                        console.log(`Data posted successfully: ${data}`);
                    }).catch((ex) => {
                        throw ex;
                    });
                });
            }

            res.status(200).send({
                code: 200,
                message: 'Successfully Posted!'
            });
        } catch (ex) {
            res.status(500).send({
                errorCode: 500,
                errorMessage: `Internal Server Error! ${ex}`
            });
        }
    });

// API to get all the feeds available for a user
userRouter.get('/:id/feeds',
    authenticate,
    async (req, res) => {
    const userid = req.params.id;

    res.setHeader('Content-Type', 'application/json');
    redis.getData(userid).then((data) => {
        res.status(200).send({
            _id: userid,
            data: data
        })
    }).catch((ex) => {
        res.status(500).send({
            errorCode: 500,
            errorMessage: `Internal Server Error! ${ex}`
        });
    });
})

// API to logout a user
userRouter.delete('/logout',
    authenticate,
    async (req, res) => {
        // Delete the current token from db
        req.user.tokens = req.user.tokens.filter((current) => {
            return current.token !== req.token
        });

        // Clearing the token from the cookie 
        res.clearCookie('jwt_token');
        await req.user.save();

        res.status(204).send();
    });

module.exports = userRouter;
