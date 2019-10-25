require('dotenv').config();

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const os = require('os');

// If modifying these scopes, delete token.json to allow for re-permissioning
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';

const databaseURL = process.env.DATABASE;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

MongoClient.connect(databaseURL, { useNewUrlParser: true })
	.then(client => {
		app.locals.db = client.db('versioner');
	})
	.catch(console.error('Failed to connect to the database'));

// returns a document that matches the filter object passed to it or null
// if no documents match the filter
// const checkIfShortIdExists = (db, code) => db.collection('shortenedURLS')
//	 .findOne({ short_id: code });

app.get('/', (req, res) => {
	const htmlPath = path.join(__dirname, 'public', 'index.html');
	res.sendFile(htmlPath);
});

app.post('/new', (req, res) => {
	let comment, content, data;
	comment = req.body.comment;
	console.log(comment);
	try {
		fs.readFile('credentials.json', (err, content) => {
		  if (err) return console.log('Error loading client secret file:', err);
		  data = authorize(JSON.parse(content), versionFile);
		});
	} catch (err) {
		return res.status(404).send(err);
	}
	const { db } = req.app.locals;
	saveVersion(db, data, comment)
	.then(result => {
		const doc = result.value;
		res.json({
			original_comment: doc.original_comment,	
      version: doc.version,
			time_stamp: doc.time_stamp,
		});
	})
	.catch(console.error);
});

const saveVersion = (db, data, comment) => {
  const versionComments = db.collection('versionComments');
  var now = new Date();
  return versionComments.findOneAndUpdate(
    { time_stamp: now }, 
    {
      $setOnInsert: {
        original_comment: comment,
        version: data,
        time_stamp: now
      },
    },
    {
      returnOriginal: false,
      upsert: true,
    }
  );
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  return fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    return callback(oAuth2Client);
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

/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function versionFile(auth) {
  const drive = google.drive({version: 'v3', auth});

  var today = new Date();
  const fileId = '13eyL9rx1IxoTwztTcDu9XXKVal2NF0ehIInezKOzGLg';
  const filename = `Portland_ME_script_draft_v${today.getDate()}.${today.getMonth()+1}.${today.getFullYear()}.docx`;

  console.log(await downloadFile(drive, filename, fileId));

  // var folderId = "1_AK0VpJ3rtq5xDVL0jg2ALWlZ8LJ9TWA";
  // var data = await uploadFile(drive, filename, folderId);  
}

async function downloadFile(drive, filename, fileId) {
	const dest = fs.createWriteStream(filename);
	const res = await drive.files.export(
		{fileId, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},
    	{responseType: 'stream'}
    );
  return res;
 //  await new Promise((resolve, reject) => {
 //    res.data
 //      .on('error', reject)
 //      .on('finish', resolve);
	// }).then(() => {
 //    return res.data;3
 //  })
}

async function uploadFile(drive, filename, folderId) {
	const fileSize = fs.statSync(filename).size;
  	const res = await drive.files.create(
  	{
      resource: {
      	'name': filename,
		// parents as Collections.singletonList(folderId)
		parents: [folderId]
      },
      media: {
      	// should upload as google docs format but broken
      	mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        body: fs.createReadStream(filename)
      },
    },
  );
  return res.data;
}

// // redirect them to the orginal URLs
// app.get('/:short_id', (req, res) => {
// 	const shortId = req.params.short_id;
// 	const { db } = req.app.locals;
// 	checkIfShortIdExists(db, shortId)
// 		.then(doc => {
// 			if (doc === null) return res.send('could not find a link at that URL');
// 			res.redirect(doc.original_url);
// 		})
// 		.catch(console.error);
// });

app.set('port', process.env.PORT || 3000);

const server = app.listen(app.get('port'), () => {
	console.log(`Express running -> PORT ${server.address().port}`);
});
