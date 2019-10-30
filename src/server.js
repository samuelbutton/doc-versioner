require('dotenv').config();

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mongodb = require('mongodb');
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const os = require('os');
const test = require('assert');
var http = require('http');

// If modifying these scopes, delete token.json to allow for re-permissioning
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';

const databaseURL = process.env.DATABASE;
const client_secret = process.env.CLIENT_SECRET;
const client_id = process.env.CLIENT_ID;
const redirect_uris = process.env.REDIRECT_URIS;
const token = process.env.TOKEN;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

mongodb.MongoClient.connect(databaseURL, { useNewUrlParser: true })
	.then(client => {
		app.locals.db = client.db('versioner');
	})
	.catch(console.error('Failed to connect to the database'));

app.get('/', (req, res) => {
	const htmlPath = path.join(__dirname, 'public', 'index.html');
	res.sendFile(htmlPath);
});

app.post('/new', (req, res) => {
	var comment = req.body.comment;
  authorize(comment, downloadFileToMDB)
  .then(result => {
    console.log(result);
    const doc = result.value;
    res.json({
      original_comment: doc.original_comment, 
      version: doc.version,
      time_stamp: doc.time_stamp,
   });
  })
  .catch(err => {
    res.send(err);
  });
});

app.get('/existing', (req, res) => {
  const { db } = req.app.locals;
  var today = new Date();
  const filename = `Portland_ME_script_draft_v${today.getDate()}.${today.getMonth()+1}.${today.getFullYear()}.docx`;
  
  downloadDoc(db, filename)
    .then(result => {
      if (result === null) return res.send('result is null');

      var filePath = path.join(__dirname, filename);

      res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      
      var writeStream = fs.createWriteStream(filePath);
      result.pipe(writeStream).
      on('error', function(error) {
          assert.ifError(error);
        }).
      on('finish', function() {
        console.log('success!');
      });
      // add message to the client about download success
    })
    .catch(console.error);
});

function downloadDoc(db, filename) {
  return new Promise((resolve, reject) => {
    var today = new Date();

    var bucket = new mongodb.GridFSBucket(db, {
      chunkSizeBytes: 1024,
      bucketName: 'versions'
    });

    resolve(bucket.openDownloadStreamByName(filename));
  }); 
}


/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {String} comment A comment given by the client.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(comment, callback) {
  return new Promise((resolve, reject) => {
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris);

    // Check if we have previously stored a token.
    oAuth2Client.setCredentials(JSON.parse(token));
    resolve(callback(oAuth2Client, comment));
  });
}

/**
 * Download file to Mongo
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {String} comment A comment given by the client.
 */
function downloadFileToMDB(auth, comment) {
  return new Promise((resolve, reject) => {
    const drive = google.drive({version: 'v3', auth});

    var today = new Date();

    // file information that can likely be saved with authentication
    const fileId = '13eyL9rx1IxoTwztTcDu9XXKVal2NF0ehIInezKOzGLg';
    const filename = `Portland_ME_script_draft_v${today.getDate()}.${today.getMonth()+1}.${today.getFullYear()}.docx`;

    const { db } = app.locals;

    var bucket = new mongodb.GridFSBucket(db, {
      chunkSizeBytes: 1024,
      bucketName: 'versions'
    });

    var uploadStream = bucket.openUploadStream(filename);

    drive.files.export(
      {fileId, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},
        {responseType: 'stream'}
      ).then(result => {
        result.data.pipe(uploadStream).
        on('error', function(error) {
          assert.ifError(error);
        }).
        on('finish', function() {
          console.log('done!');
        });
    });

    const versions = db.collection('versions');
    var now = new Date();
    var result = versions.findOneAndUpdate(
      { time_stamp: now },
      {
        $setOnInsert: {
          original_comment: comment,
          versionName: filename,
          time_stamp: now
        },
      },
      {
        returnOriginal: false,
        upsert: true,
      }
    );

    resolve(result);

  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

app.set('port', process.env.PORT || 3000);

const server = app.listen(app.get('port'), () => {
	console.log(`Express running -> PORT ${server.address().port}`);
});
