const express = require('express');
const app = express();

app.use(express.json());

app.get('/', (req, res) => {
    res.send("backend page")
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`The server is running at http://localhost:${PORT}`)
});


