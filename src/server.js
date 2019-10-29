require('dotenv').config();

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mongodb = require('mongodb');
const fs = require('fs');
// const fh = require('fs').promises.FileHandle
const readline = require('readline');
const {google} = require('googleapis');
const os = require('os');
test = require('assert');

// If modifying these scopes, delete token.json to allow for re-permissioning
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';

const databaseURL = process.env.DATABASE;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

mongodb.MongoClient.connect(databaseURL, { useNewUrlParser: true })
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
	let comment;
	comment = req.body.comment;
  // should change the below to promise, and include catch to catch errors
  const fileId = '13eyL9rx1IxoTwztTcDu9XXKVal2NF0ehIInezKOzGLg';
	
  fs.readFile('credentials.json', (err, content) => {
    if (err) return err;
    authorize(JSON.parse(content))
    // .then(result => tokenize)
    .catch(result => {
      console.log(result);
    });
    // .then((result, fileId) => getDataFromGoogle)
    // .catch(console.log("problem with authorize method"))
    // .then(result => saveToMDB)
    // .catch(console.log("problem with getDataFromGoogle method"))
    // .then(result => {
    //   const doc = result.value;
    //   res.json({
    //     original_comment: doc.original_comment, 
    //     version: doc.version,
    //     time_stamp: doc.time_stamp,
    //   });
    // })
    // .catch(console.log("problem with saveToMDB method"));
  });
 //  try {
	// 	fs.readFile('credentials.json', (err, content) => {
	// 	  return authorize(JSON.parse(content), downloadFileToMDB);
	// 	});
 //   //  .then(result => {
 //   //   const doc = result.value;
 //   //   res.json({
 //   //    original_comment: doc.original_comment, 
 //   //    versionName: doc.versionName,
 //   //    versionId: doc.versionId,
 //   //    time_stamp: doc.time_stamp,
 //   //  });
 //   // }) 
	// } catch (err) {
	// 	throw err;
	// }
  // console.log(data);
 //  const { db } = req.app.locals;
	// saveVersion(db, data, comment)
	// .then(result => {
	// 	const doc = result.value;
	// 	res.json({
	// 		original_comment: doc.original_comment,	
 //      version: doc.version,
	// 		time_stamp: doc.time_stamp,
	// 	});
	// })
	// .catch(console.error);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials) {

  return new Promise((resolve, reject) => {
    
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    resolve(oAuth2Client);
    if (err) reject(err);
  });
}

function tokenize(oauth) {
  return new Promise((resolve, reject) => {
    var result = fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) return getAccessToken(oauth);
      oauth.setCredentials(JSON.parse(token));
    });
    resolve(result);
    if (result == null) reject();
  });
}

function getAccessToken(oAuth2Client) {
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
      return oAuth2Client;
    });
  });
}


function getDataFromGoogle(fileId, auth) {
  return new Promise((resolve, reject) => {
    const drive = google.drive({version: 'v3', auth});
    var today = new Date();
    var result = drive.files.export(
    {fileId, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},
      {responseType: 'stream'}
    );
    resolve(result);
    // if (result == null) reject();
  });
}

function saveToMDB(res) {
  return new Promise((resolve, reject) => {
    // to be replaced with pull from "res", or the request
    const filename = `Portland_ME_script_draft_v${today.getDate()}.${today.getMonth()+1}.${today.getFullYear()}.docx`;
    const dest = fs.createWriteStream(filename);
    const { db } = app.locals;

    var bucket = new mongodb.GridFSBucket(db, {
      chunkSizeBytes: 1024,
      bucketName: 'versions'
    });

    // save file
    var uploadStream = bucket.openUploadStream(filename);
    var id = uploadStream.id;

    res.data.pipe(uploadStream).
    on('error', function(error) {
      assert.ifError(error);
    }).
    on('finish', function() {
      console.log('done!');
    });

    // save file information to collection
    var result = uploadStream.once('finish', function() {
      const versionComments = db.collection('versionsDetail');
      today = new Date();
      return versionsDetail.findOneAndUpdate(
        { time_stamp: today },
        {
          $setOnInsert: {
            original_comment: "hardcoded comment",
            versionName: filename,
            versionId: id,
            time_stamp: today
          },
        },
        {
          returnOriginal: false,
          upsert: true,
        }
      );
    });
    resolve(result);
    // if (result == null) reject();
  });
}

function downloadFileToMDB(auth) {
  // file information that can likely be saved with authentication
  const fileId = '13eyL9rx1IxoTwztTcDu9XXKVal2NF0ehIInezKOzGLg';

  getDataFromGoogle(fileId, auth)
  .then(result => saveToMDB)
  .then(result => {
    return result;
  });

  // .then(result => {
  //   return result;
  // });
  // download logic  
  // var downloadStream = bucket.openDownloadStreamByName('test.dat');

  // uploadStream.once('finish', function() {
  //   var downloadStream = bucket.openDownloadStreamByName('test.dat');

  //   downloadStream.pipe(fs.createWriteStream('./output.docx')).
  //     on('error', function(error) {
  //       assert.ifError(error);
  //     }).
  //   on('finish', function() {
  //     console.log('done2!');
  //     // process.exit(0);
  //   });
  // });
}

// const saveVersion = (db, data, comment) => {
//   const versionComments = db.collection('versionComments');
//   var now = new Date();
//   return versionComments.findOneAndUpdate(
//     { time_stamp: now },
//     {
//       $setOnInsert: {
//         original_comment: comment,
//         version: data,
//         time_stamp: now
//       },
//     },
//     {
//       returnOriginal: false,
//       upsert: true,
//     }
//   );
// }

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */


// async function downloadFile(drive, filename, fileId) {

// the code below is working versioning logic, but needs to be split up into a client facing order

	// const dest = fs.createWriteStream(filename);
	// const res = await drive.files.export(
	// 	{fileId, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'},
 //    	{responseType: 'stream'}
 //    );
 //  console.log(res);
 //  const { db } = app.locals;
 //  const versionComments = db.collection('versionComments');

 //  var bucket = new mongodb.GridFSBucket(db, {
 //    chunkSizeBytes: 1024,
 //    bucketName: 'versions'
 //  });

 //  var uploadStream = bucket.openUploadStream('test.dat');
 //  var id = uploadStream.id;

 //  await res.data.pipe(uploadStream).
 //    on('error', function(error) {
 //      assert.ifError(error);
 //    }).
 //    on('finish', function() {
 //      console.log('done!');
 //      // process.exit(0);
 //    });


  // var now = new Date();
  // versionComments.findOneAndUpdate(
  //   { time_stamp: now },
  //   {
  //     $setOnInsert: {
  //       original_comment: "hardcoded comment",
  //       versionName: filename,
  //       time_stamp: now
  //     },
  //   },
  //   {
  //     returnOriginal: false,
  //     upsert: true,
  //   }
  // );

  // const bucket2 = new mongodb.GridFSBucket(db, {
  //   chunkSizeBytes: 1024,
  //   bucketName: 'versions'
  // });
  // var CHUNKS_COLL = 'versions.chunks';
  // var FILES_COLL = 'versions.files';

  // var downloadStream = bucket.openDownloadStreamByName('test.dat');

  // uploadStream.once('finish', function() {
  //   var downloadStream = bucket.openDownloadStreamByName('test.dat');

  //   downloadStream.pipe(fs.createWriteStream('./output.docx')).
  //     on('error', function(error) {
  //       assert.ifError(error);
  //     }).
  //   on('finish', function() {
  //     console.log('done2!');
  //     // process.exit(0);
  //   });
  // });

  // bucket.openDownloadStreamByName('example').
  //   pipe(fs.createWriteStream('./output.docx')).
  //   on('error', function(error) {
  //     assert.ifError(error);
  //   }).
  //   on('finish', function() {
  //     console.log('done2!');
  //     // process.exit(0);
  // });


  // return res;
 //  await new Promise((resolve, reject) => {
 //    res.data
 //      .on('error', reject)
 //      .on('finish', resolve);
	// }).then(() => {
 //    return res.data;3
 //  })
// }

// async function uploadFile(drive, filename, folderId) {
// 	const fileSize = fs.statSync(filename).size;
//   	const res = await drive.files.create(
//   	{
//       resource: {
//       	'name': filename,
// 		// parents as Collections.singletonList(folderId)
// 		parents: [folderId]
//       },
//       media: {
//       	// should upload as google docs format but broken
//       	mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//         body: fs.createReadStream(filename)
//       },
//     },
//   );
//   return res.data;
// }

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
