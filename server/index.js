const keys = require('./keys')

// Express App Setup
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(bodyParser.json())

// Postgres Client Setup
const { Pool } = require('pg')
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
})

pgClient.on('connect', () => {
  pgClient
    .query('CREATE TABLE IF NOT EXISTS values (number INT)')
    .catch((err) => console.log(err))
})

// Redis Client Setup
const redis = require('redis')
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
})
const redisPublisher = redisClient.duplicate()

// Express route handlers

app.get('/', (req, res) => {
  res.status(200).send('The API is up and running!')
})

app.get('/values/all', async (req, res) => {

  try {
    const values = await pgClient.query('SELECT * from values')
    res.status(200).send(values.rows)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }

})

app.get('/values/current', async (req, res) => {
  try {
    redisClient.hgetall('values', (err, values) => {
      res.status(200).send(values)
    })
    
  } catch (error) {
    res.status(400).json({ error: error.message})
  }
})

app.post('/values', async (req, res) => {
  const index = req.body.index

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high')
  }

  try {
    redisClient.hset('values', index, 'Nothing yet!')
    redisPublisher.publish('insert', index)
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index])
  
    res.status(200).send({ working: true })
  } catch (error) {
    res.status(400).json({ error: error.message})
  }
})

app.listen(5000, (err) => {
  console.log('API is listening on port 5000!')
})
