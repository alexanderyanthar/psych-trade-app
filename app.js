const express = require('express');
const app = express();
const ejs = require('ejs');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { Schema } = require('mongoose');
require('dotenv').config()

app.use(express.static(path.join(__dirname, 'public')));

const port = process.env.PORT || 3000;
const uri = process.env.MONGO_URI;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));



// Connect to MongoDB Atlas
mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    assessments: [{ type: Schema.Types.ObjectId, ref: 'AssessmentAnswer' }]
});

const answerSchema = new mongoose.Schema({
    question: { type: Schema.Types.ObjectId, ref: 'Question' },
    selectedOption: String,
})

const questionSchema = new mongoose.Schema({
    text: String,
    type: String,
    options: [{
        text: String,
        points: {
            type: Number
        },
    }],
});

const assessmentSchema = new mongoose.Schema({
    name: String,
    assessmentType: {
        type: String,
        enum: ['Analysis', 'TypeOfTrader', 'CognitiveBias'],
        required: true,
    },
    questions: [questionSchema],
    answers: [answerSchema],
});

const assessmentAnswerSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    userPreference: {
        type: String,
        required: true,
    },
    assessmentResults: [
        {
            type: {
                type: String,
            },
            points: {
                type: Number,
            },
            // You can add more fields specific to each result type if needed
        },
    ],
});

const AssessmentAnswer = mongoose.model('AssessmentAnswer', assessmentAnswerSchema);



const Question = mongoose.model('Question', questionSchema);
const Answer = mongoose.model('Answer', answerSchema);
const Assessment = mongoose.model('Assessment', assessmentSchema);



const User = mongoose.model('User', userSchema);



app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());
app.use(cookieParser());

app.get('/', (req, res) => {
    res.send('Hello express');
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already taken' });
        }

        const hashedPassword = await bcrypt.hash(password, 10); // 10 is the number of salt rounds

        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();

        const token = jwt.sign({ userId: newUser._id }, 'your-secret-key', { expiresIn: '1h' });

        res.cookie('jwt', token, { httpOnly: true, maxAge: 3600000 }); // Set the token as a cookie

        // Redirect to the profile page after successful login
        res.redirect('/profile');
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Authentication failed' });
        }

        // Compare the entered password with the stored hashed password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Authentication failed' });
        }

        const token = jwt.sign({ userId: user._id }, 'your-secret-key', { expiresIn: '1h' });

        res.cookie('jwt', token, { httpOnly: true, maxAge: 3600000 });

        // Redirect to the profile page after successful login
        console.log('user and pass', username, password);
        res.redirect('/profile');
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/profile', (req, res) => {
    try {
        const token = req.cookies.jwt;

        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        jwt.verify(token, 'your-secret-key', async (err, decodedToken) => {
            if (err) {
                return res.status(403).json({ message: 'Invalid token' });
            }

            const userId = decodedToken.userId;
            const user = await User.findById(userId).populate({
                path: 'assessments',
                model: 'AssessmentAnswer',
            });

            const hasTakenAssessment = user.assessments.length > 0;
            let userPreference = '';

            if (hasTakenAssessment) {
                userPreference = user.assessments[0].userPreference;
            }

            res.render('profile', { username: user.username, hasTakenAssessment, userPreference });
        });
    } catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});