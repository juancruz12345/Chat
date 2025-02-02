import express from 'express'
import { Server } from 'socket.io'
import { createServer } from 'node:http'
import dotenv from 'dotenv'
import { createClient } from '@libsql/client'


const port = process.env.PORT ?? 3000

const app = express()
const server = createServer(app)
const io = new Server(server)

dotenv.config()

const db = createClient({
  url:process.env.DB_URL,
  authToken: process.env.DB_TOKEN
})

await db.execute("CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,content TEXT)")

io.on('connection', async(socket) => {
  console.log('a user has connected!')
  
  console.log(socket.handshake.auth)
  socket.on('disconnect', () => {
    console.log('an user has disconnected')
  })

  socket.on('chat message', async(msg) => {
   
    let result
    try{
      result = await db.execute({
        sql: 'INSERT INTO messages (content) VALUES (:msg)',
        args: {msg}
      })

    }catch(error){
      console.log(error)
      return
    }
    
    io.emit('chat message', msg, result.lastInsertRowid.toString())
  })
  

  if(!socket.recovered){
    try{
      const results = await db.execute({
        sql: "SELECT * FROM messages WHERE id > ?",
        args:[socket.handshake.auth.serverOffset ?? 0]
      })

      results.rows.forEach(row =>{
        socket.emit('chat message', row.content, row.id.toString())
      })

    }catch(e){
      console.log(e)
    }
  }

})

app.use(express.static('public'));
app.get('/', (req, res) => {
  
  
  res.sendFile(process.cwd()+'/public/client/index.html')
})

server.listen(port, () => {
  console.log(`Server running on port ${port}`)
})


