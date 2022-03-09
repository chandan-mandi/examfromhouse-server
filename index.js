const express = require('express');
const { MongoClient } = require('mongodb');
require('dotenv').config();
const cors = require('cors');
const ObjectId = require('mongodb').ObjectId;
const fileUpload = require('express-fileupload')
const _ = require('lodash');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(fileUpload());
global._ = _;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9pclo.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run() {
    try {
        await client.connect();
        console.log('database connected');
        const database = client.db('online_exam');
        const questionsCollection = database.collection('questions');
        const responsesCollection = database.collection('responses');
        const questionSetCollection = database.collection('questionSet');
        const usersCollection = database.collection('users');
        const reviewsCollection = database.collection('reviews');
        const fileCollection = database.collection('fileCollection');

        // GET questions API
        app.get('/questions', async (req, res) => {
            const cursor = questionsCollection.find({});
            const questions = await cursor.toArray();
            res.send(questions);
        });

        // get questions by email query
        app.get("/questions/:email", async (req, res) => {
            const cursor = questionsCollection.find({ email: req.params.email });
            const result = await cursor.toArray();
            res.json(result);
        });

        // POST questions API
        app.post('/addQuestions', async (req, res) => {
            const newQuestion = req.body;
            const result = await questionsCollection.insertOne(newQuestion);
            res.json(result);
        });

        // GET question set API
        app.get('/questionSet', async (req, res) => {
            const cursor = questionSetCollection.find({});
            const questionSet = await cursor.toArray();
            res.send(questionSet);
        });

        // get question set by email query
        app.get("/myQuestionSet/:email", async (req, res) => {
            const cursor = questionSetCollection.find({ email: req.params.email });
            const result = await cursor.toArray();
            res.json(result);
        });

        // GET Single question set 
        app.get('/questionSet/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const quesSet = await questionSetCollection.findOne(query);
            res.json(quesSet);
        })

        // Update single question set details
        app.put('/questionSet/:id', async (req, res) => {
            const id = req.params.id;
            const updatedQuestions = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    instituteName: updatedQuestions.instituteName,
                    examTitle: updatedQuestions.examTitle,
                    examDescription: updatedQuestions.examDescription,
                    examTime: updatedQuestions.examTime,
                    date: updatedQuestions.date,
                    startingTime: updatedQuestions.startingTime,
                    endingTime: updatedQuestions.endingTime
                },
            };
            const result = await questionSetCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        })

        // POST question set API
        app.post('/addQuestionSet', async (req, res) => {
            const newQuestionSet = req.body;
            const result = await questionSetCollection.insertOne(newQuestionSet);
            res.json(result);
        });
        // POST SINGLE FILE 
        app.post("/fileupload", async (req, res) => {
            console.log("body data", req.body);
            const fileName = req.body.fileName;
            const fileType = req.body.type;
            const file = req.files.file;
            const fileData = file.data;
            const encodedFile = fileData.toString('base64');
            const fileBuffer = Buffer.from(encodedFile, 'base64');
            const files = {
                fileName,
                fileType,
                answer: fileBuffer
            }
            const result = await fileCollection.insertOne(files)
            res.json(result)
        })
        // GET SINGLE  FILE 
        app.get("/getFile/:id", async (req, res) => {
            const fileId = req.params.id;
            const query = { _id: ObjectId(fileId) }
            const responses = await fileCollection.findOne(query);
            res.json(responses)
        })
        // GET responses API
        app.get('/responses', async (req, res) => {
            const cursor = responsesCollection.find({});
            const responses = await cursor.toArray();
            res.send(responses);
        });
        // GET MY RESULT API
        app.get("/responses/:email", async (req, res) => {
            const email = req.params.email;
            const query = { studentEmail: email }
            const result = await responsesCollection.find(query).toArray();
            res.json(result);
        })
        // GET SINGLE RESPONSE FROM QUESTION ID 
        app.get("/responses/singleSet/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const responses = await responsesCollection.findOne(query);
            async function calculate(questions) {
                console.log('collect', questions);
                let score = questions.score;
                questions.studentAns?.forEach((question) => {
                    if (question.obtainMark) {
                        score += parseInt(question.obtainMark)
                    }
                })
                return score
            }
            const userScore = await calculate(responses);
            console.log("update mark", userScore);
            res.json({
                responses,
                userScore
            })
        })
        // UPDATE STUDENT MARKS
        app.put('/markupdate/:id', async (req, res) => {
            const id = req.params.id;
            const stdMarkUpdated = req.body;
            const filter = { _id: ObjectId(id) };

            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    studentAns: stdMarkUpdated
                },
            };
            const result = await responsesCollection.updateOne(filter, updateDoc, options);
            const questionsCollect = await responsesCollection.findOne(filter);
            async function calculate(questions) {
                console.log('collect', questions);
                let score = questions.score;
                questions.studentAns?.forEach((question) => {
                    if (question.obtainMark) {
                        score += parseInt(question.obtainMark)
                    }
                })
                return {
                    score
                }
            }
            const userScore = await calculate(questionsCollect);
            console.log("update mark", userScore);
            res.json(result);
        })

        // POST responses API
        app.post('/responses', async (req, res) => {
            const newResponses = req.body;
            console.log(newResponses);
            const qna = req.body.studentAns;
            const quesId = req.body.quesId;
            const query = { _id: ObjectId(quesId) };
            const questionsCollect = await questionSetCollection.findOne(query);
            async function calculate(questions) {
                console.log('collect', questions);
                let score = 0;
                let totalMarks = 0;
                questions.questions?.forEach((question, index1) => {
                    let correctIndexes = [],
                        checkedIndexes = [];
                    if (question.options) {
                        question.options.forEach((option, index2) => {
                            if (option.correct) correctIndexes.push(index2)
                            if (qna[index1].options[index2].checked) {
                                checkedIndexes.push(index2);
                                option.checked = true;
                            }
                        });
                        if (_.isEqual(correctIndexes, checkedIndexes)) {
                            score = score + parseInt(question.mark);
                        }
                    }
                    if (question.obtainMark) {
                        score += parseInt(question.obtainMark)
                    }
                    totalMarks = totalMarks + parseInt(question.mark)
                })
                return {
                    score,
                    totalMarks
                }
            }
            const userScore = await calculate(questionsCollect);
            const stdRes = { ...newResponses, ...userScore }
            console.log("stdres", stdRes);
            const result = await responsesCollection.insertOne(stdRes);
            res.json(result);
        });

        // GET Users API
        app.get('/users', async (req, res) => {
            const cursor = usersCollection.find({});
            const users = await cursor.toArray();
            res.json(users);
        });

        //add users in database
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.json(result);
        })

        //update users
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });

        // GET Reviews API
        app.get('/reviews', async (req, res) => {
            const cursor = reviewsCollection.find({});
            const reviews = await cursor.toArray();
            res.json(reviews);
        });

        // POST reviews API
        app.post('/reviews', async (req, res) => {
            const newReviews = req.body;
            const result = await reviewsCollection.insertOne(newReviews);
            res.json(result);
        });

        // DELETE questions
        app.delete('/questions/:email', async (req, res) => {
            const query = { email: req.params.email };
            const result = await questionsCollection.deleteMany(query);
            res.json(result);
        });

        // DELETE questions by id
        app.delete('/question/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await questionsCollection.deleteOne(query);
            res.json(result);
        });

        // DELETE question set by id
        app.delete('/questionSet/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await questionSetCollection.deleteOne(query);
            res.json(result);
        });
    }
    finally {
        //   await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Running my server');
})

app.listen(port, () => {
    console.log('Running server on port', port);
})