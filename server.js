var fs = require("fs"),
	path = require('path'),
	http = require("http"),
	url = require("url"),
	util = require("util"),
	qs = require("querystring");

var musixmatchLyricsAPIKey = '8a9c004f3675bca796ec4d1fb79d30da';

var client_id;
var client_secret;
var redirect_uri;
var site_url;
var Host;


var request = require('request'); // "Request" library
var Cookies = require('cookies'); //cookies module
var Promise = require('promise'); //
const sqlite3 = require('sqlite3'); //sqlite3 module

var credentials = require('./credentials.json');
// console.log(credentials);


var access_token = null;
// var userKeyAndTokens = {};
// var userCurrentPlayingDataArray = [];
// var userDataArray = [];

//open database------
const db_path = 'database.db';
var db;
// activateServer(8888); // port number on localhost!
activateServer(80); // port number on server!

function createDBConnection(db_path) {

	return new Promise(function (resolve, reject) {
		db = new sqlite3.Database(db_path, function (err) {
			if (err) {
				return console.error(err.message);
				reject(err);
			} else {
				resolve('Connected to ' + db_path + ' SQlite database.');
			}
		});
	});
}

function activateServer(portNumber) {
	//check if db file exists, if not, reset Database with resetDB script.
	fs.readFile(db_path, function (error, content) {

		if (error) {
			console.log('Can\'t find file----' + db_path + '----Please reset Database.');

		} else {
			//database file exist, listen to port!
			console.log('-----' + db_path + ' exist!---------open port');
			createDBConnection(db_path).then(function (msg) {
				server.listen(portNumber);
			}).catch(function (err) {
				console.log(err);
			});
		}
	});
}

function addslashes(str) {
	return (str + '').replace(/'/g, "''").replace(/"/g, "\"\"");
}

function removeslashes(str) {
	return (str + '').replace(/''/g, "'").replace(/""/g, "\"");
}

var generateRandomString = function (length) {
	var text = '';
	var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	for (var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
};

var getNewAccessToken = function (refresh_token) {
	return new Promise(function (resolve, reject) {
		var options = {
			url: 'https://accounts.spotify.com/api/token',
			form: {
				grant_type: 'refresh_token',
				refresh_token: refresh_token
			},
			headers: {
				'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')
			}
		};

		request.post(options, function (error, response, body) {
			if (response.statusCode === 200) {
				console.log('got refreshed access token!');
				resolve(body);

			} else {
				console.log('get refreshed access token failed');
				reject(body);
			}
		});
	});
};

var getSongLyrics = function (name, artist) {
	var NameOfSong = name;
	var ArtistName = artist;
	var baseURL = 'https://api.musixmatch.com/ws/1.1/';
	var getLyrcs = 'matcher.lyrics.get?';
	var format = 'format=json&callback=callback&';
	var q_track = '&q_track=' + NameOfSong;
	var q_artist = '&q_artist=' + ArtistName;
	var musixMatchAPIKey = '&apikey=8a9c004f3675bca796ec4d1fb79d30da';


	return new Promise(function (resolve, reject) {
		var options = {
			url: baseURL + getLyrcs + format + q_track + q_artist + musixMatchAPIKey,
		};

		request.get(options, function (error, response, body) {
			if (error) {
				reject(body);
			} else {

				if (response.statusCode === 200) {

					var bodyJson = JSON.parse(body);

					if (bodyJson.message.header.status_code === 200) {
						console.log('GOT THE LYRICS!!!!!!!!!!!!!!!');
						// console.log(bodyJson.message.body);
						resolve(bodyJson.message.body);
					} else {
						console.log('FAILED TO GET LYRICS');
						reject(body);
					}

				} else {
					console.log('FAILED TO GET LYRICS');
					reject(body);
				}
			}
		});
	});

};

var insertDataToSQLite3 = function (selectQ, updateQ, insertQ, insertParams) {
//try to insert userKey and userToken to SQLite3
	return new Promise(function (resolve, reject) {
		if (insertQ !== undefined && insertParams !== undefined) {

			db.all(selectQ, function (err, rows) {
				if (err) {
					reject('failed' + insertQ);
				} else {
					// console.log(' get userKey -----');
					if (rows[0]['COUNT(*)'] < 1) {
						//row userKey doesn't exist--insert it
						db.run(insertQ, insertParams, function (err, rows) {
							if (err) {
								// console.log('inserted failed---');
								reject(err);
							} else {
								console.log(rows);
								resolve('inserted row---' + insertQ);
							}
						});
					} else {
						//userKey already exist, need to update userToken!
						// console.log(rows);
						db.run(updateQ, [], function (err, rows) {
							if (err) {
								reject({
									err: err,
									updateQuery: updateQ
								});
							} else {
								// console.log('update successfully--' + updateQ);
								resolve({
									result: 'success',
									updateQuery: updateQ
								});
							}
						});
					}
				}
			});

		} else {
			db.all(selectQ, function (err, rows) {
				// console.log('------SELECT QUERY---------' + selectQ);
				if (err) {
					reject(err.message);
				} else {

					if (rows[0]['COUNT(*)'] >= 0) {
						//userKey exist, update userInfo
						db.run(updateQ, [], function (err, rows) {
							if (err) {
								reject(err);
							} else {
								// console.log('update successfully--' + updateQ);
								resolve({
									result: 'success',
									updateQuery: updateQ
								});

							}
						});
					}
				}
			});
		}
	});
};

var getRefreshTokenFromSQL = function (userKey) {

	return new Promise(function (resolve, reject) {
		var selectQuery = "SELECT refreshToken FROM users WHERE userKey='" + userKey + "'";

		db.get(selectQuery, [], function (err, rows) {
			if (err) {
				err.sql = selectQuery;
				reject(err);
			} else {
				if( rows === undefined){
					reject({
						getRefreshTokenFromSQLRows: rows,
						error: 'function getRefreshTokenFromSQL: Returned rows is undefined.'
					});
				}else{
					resolve(rows);
				}
			}
		});
	});
};

var getUserTokenFromSQL = function (userKey) {

	return new Promise(function (resolve, reject) {
		var selectQuery = "SELECT userToken FROM users WHERE userKey='" + userKey + "'";

		db.get(selectQuery, [], function (err, rows) {
			if (err) {
				err.sql = selectQuery;
				reject(err);
			} else {
				if( rows === undefined){
					reject({
						getUserTokenFromSQLRows: rows,
						error: 'function getUserTokenFromSQL: Returned rows is undefined.'
					});
				}else{
					resolve(rows);
				}
			}
		});
	});

};

var getCurrentPlayDataFromSQL = function (userKey) {

	return new Promise(function (resolve, reject) {
		var selectQuery = "SELECT currentPlayingData FROM users WHERE userKey='" + userKey + "'";

		db.get(selectQuery, [], function (err, rows) {
			if (err) {
				err.sql = selectQuery;
				reject(err);
			} else {
				if( rows === undefined){
					reject({
						getCurrentPlayDataFromSQLRows: rows,
						error: 'function getCurrentPlayDataFromSQL: Returned rows is undefined.'
					});
				}else{
					resolve(rows);
				}
			}
		});
	});

};

var getUserInfoFromSQL = function (userKey) {

	return new Promise(function (resolve, reject) {
		var selectQuery = "SELECT userInfo FROM users WHERE userKey='" + userKey + "'";

		db.get(selectQuery, [], function (err, rows) {
			if (err) {
				err.sql = selectQuery;
				reject(err);
			} else {
				if( rows === undefined){
					reject({
						rows: rows,
						error: 'Returned rows is undefined.'
					});
				}else{
					resolve(rows);
				}
			}
		});
	});

};

var insertUserInfo = function (userKey, access_token) {

	return new Promise(function (resolve, reject) {
		var options = {
			url: 'https://api.spotify.com/v1/me',
			headers: {'Authorization': 'Bearer ' + access_token},
			json: true
		};

		// use the access token to access the Spotify Web API
		request.get(options, function (error, response, body) {

			if (response.statusCode !== 200) {
				console.log('Failed to access Spotify Web API----' + access_token);
				reject(body);

			} else {
				//insert user data to SQLite after getting it from Spotify API, no need to push into userDataArray
				// userDataArray[access_token] = body;
				var selectQuery = "SELECT COUNT(*) FROM users WHERE userKey='" + userKey + "'";
				var updateQuery = "UPDATE users SET userInfo='" + addslashes(JSON.stringify(body)) + "' WHERE userKey='" + userKey + "'";

				insertDataToSQLite3(selectQuery, updateQuery).then(function (message) {
					resolve(body);
				}).catch(function (err) {
					reject(err);
				})
			}

		});
	});
};

var insertCurrentPlayContent = function (userKey, access_token) {

	return new Promise(function (resolve, reject) {
		// console.log('===get current player content====' + '    ' + access_token);
		var options = {
			url: 'https://api.spotify.com/v1/me/player',
			headers: {
				Accept: 'application/json',
				ContentType: 'application/json',
				Authorization: 'Bearer ' + access_token
			},
			json: true
		};

		request.get(options, function (error, content, body) {
			// console.log('--------373--------');
			// console.log(body);

			if (error) {
				console.log('get request failed');
				console.log(error);
			} else {
				//if there is error in body
				if (body !== undefined) {
					if ("error" in body) {
						console.log('---There is error in insertCurrentPlayContent function---');
						reject(body);

					} else {
						//dont need to insert current playing data to array now, insert to SQLite instead
						// userCurrentPlayingDataArray[access_token] = body;
						var selectQuery = "SELECT COUNT(*) FROM users WHERE userKey='" + userKey + "'";
						var updateQuery = 'UPDATE users SET currentPlayingData="' + addslashes(JSON.stringify(body)) + '" WHERE userKey="' + userKey + '"';

						insertDataToSQLite3(selectQuery, updateQuery).then(function (message) {
							resolve(body);
						}).catch(function (err) {
							reject(err);
						});
					}
				} else {
					// console.log(content.headers.connection);
					reject({
						connection: content.headers.connection,
						content: content
					});
				}
			}
		});
	});
};

// var insertDataToSQLite3 = function (selectQ, updateQ, insertQ, insertParams) {
// //try to insert userKey and userToken to SQLite3
//
// 	if (insertQ !== undefined && insertParams !== undefined) {
// 		db.all(selectQ, function (err, rows) {
// 			// console.log(rows);
// 			// console.log('------SELECT QUERY---------' + selectQ);
// 			if (err) {
// 				return console.log(err);
// 			} else {
// 				// console.log(' get userKey -----');
//
// 				if (rows[0]['COUNT(*)'] < 1) {
//
// 					//row userKey doesn't exist--insert it
// 					db.run(insertQ, insertParams, function (err, rows) {
// 						if (err) {
// 							// console.log('inserted failed---');
// 							console.log(err);
// 							console.log('line 65')
// 						} else {
// 							// console.log('inserted row--' + insertQ);
// 						}
// 					});
// 				} else {
// 					//userKey already exist, need to update userToken!
// 					// console.log(rows);
// 					db.run(updateQ, [], function (err, rows) {
// 						if (err) {
// 							console.log(err);
// 							console.log('line 76');
// 						} else {
// 							// console.log('update successfully--' + updateQ);
// 						}
// 					});
// 				}
// 			}
// 		});
//
// 	} else {
// 		db.all(selectQ, function (err, rows) {
// 			// console.log('------SELECT QUERY---------' + selectQ);
// 			if (err) {
// 				return console.log(err.message);
// 			} else {
//
// 				if (rows[0]['COUNT(*)'] >= 0) {
// 					//userKey exist, update userInfo
// 					// console.log(rows);
// 					db.run(updateQ, [], function (err, rows) {
// 						if (err) {
// 							console.log(err);
// 							console.log('line 98');
// 							// console.log(updateQ);
// 						} else {
// 							// console.log('update successfully--' + updateQ);
//
// 						}
// 					});
// 				}
// 			}
// 		});
// 	}
// };
//
// var insertUserInfo = function (userKey, access_token) {
//
// 		var options = {
// 			url: 'https://api.spotify.com/v1/me',
// 			headers: {'Authorization': 'Bearer ' + access_token},
// 			json: true
// 		};
//
// 		// use the access token to access the Spotify Web API
// 		request.get(options, function (error, response, body) {
//
// 			userDataArray[access_token] = body;
// 			console.log('get user info function------------');
// 			// console.log(addslashes(JSON.stringify(body)));
// 			// console.log(userDataArray[access_token]);
//
// 			//insert userInfo to database
// 			var selectQuery = "SELECT COUNT(*) FROM users WHERE userKey='" + userKey + "'";
// 			var updateQuery = "UPDATE users SET userInfo='"+ addslashes(JSON.stringify(body)) + "' WHERE userKey='" + userKey + "'";
//
// 			// console.log(updateQuery);
//
//
// 			insertDataToSQLite3(selectQuery, updateQuery);
//
// 		});
//
// };
//

// var insertCurrentPlayContent = function (userKey, access_token) {
// 	// console.log('===get current player content====' + '    ' + access_token);
// 	var options = {
// 		url: 'https://api.spotify.com/v1/me/player',
// 		headers: {
// 			Accept: 'application/json',
// 			ContentType: 'application/json',
// 			Authorization: 'Bearer ' + access_token
// 		},
// 		json: true
// 	};
//
// 	request.get(options, function (error, content, body) {
//
// 		userCurrentPlayingDataArray[access_token] = body;
//
// 		// console.log((JSON.stringify(body)));
// 		// console.log('-------');
//
//
// 		//insert currentplayingdata to sqlite3
// 		var selectQuery = "SELECT COUNT(*) FROM users WHERE userKey='" + userKey + "'";
// 		var updateQuery = 'UPDATE users SET currentPlayingData="' + addslashes( JSON.stringify(body) ) + '" WHERE userKey="' + userKey + '"';
//
// 		insertDataToSQLite3(selectQuery, updateQuery);
// 		// userCurrentPlayingData = body;
// 		// console.log('get current play song-------------');
// 	});
//
// };

var playerFuncs = function (access_token, method, action) {
	console.log('play action is: ' + action + '-----------------');
	var options = {
		url: 'https://api.spotify.com/v1/me/player/' + action,
		headers: {
			Accept: 'application/json',
			ContentType: 'application/json',
			Authorization: 'Bearer ' + access_token
		},
		json: true
	};

	// if (action === "play") {

		//change song code
		// if(userCurrentPlayingDataArray[access_token] === undefined)
		// {
		// 	console.log("------------ USER PLAYING DATA UNDEFINED");
		// 	options = {
		// 		url: 'https://api.spotify.com/v1/me/player/' + action,
		// 		headers: {
		// 			Accept: 'application/json',
		// 			ContentType: 'application/json',
		// 			Authorization: 'Bearer ' + access_token
		// 		},
		// 		body: {
		// 			context_uri: "spotify:album:5ht7ItJgpBH7W6vJ5BqpPr",
		// 			offset: {
		// 				position: 5
		// 			},
		// 			position_ms: 0
		// 		},
		// 		json: true
		// 	};
		// }
	// }

	if (method === 'GET') {
		request.get(options, function (error, content, body) {
			console.log('========GET=========');
			// if (action === '') {
				// userCurrentPlayingDataArray[access_token] = body;
				// userCurrentPlayingData = body;
			// }
		});
	} else if (method === 'POST') {
		request.post(options, function (error, content, body) {
			console.log('---------------POST------------');
			// console.log(body);
		});
	} else if (method === 'PUT') {

		request.put(options, function (error, content, body) {
			console.log('---------------PUT--------------' + access_token);
			console.log(body);
		});

	}
};

var stateKey = 'spotify_auth_state';

process.on('exit', (code) => {
	console.log('About to exit with code:', code);
});


var server = http.createServer(function (req, res) {

	Host = req.headers.host;

	if (Host === 'localhost:8888') {
		client_id = credentials.localCredentials.client_id;
		client_secret = credentials.localCredentials.client_secret;
		redirect_uri = credentials.localCredentials.redirect_uri;
		site_url = credentials.localCredentials.site_url;
	} else {
		console.log(Host);
		client_id = credentials.serverCredentials.client_id;
		client_secret = credentials.serverCredentials.client_secret;
		redirect_uri = credentials.serverCredentials.redirect_uri;
		site_url = credentials.serverCredentials.site_url;
	}


	var queryData = url.parse(decodeURIComponent(req.url), true);

	const xpath = queryData.pathname, query = queryData.query;
	const method = req.method;

	if (req.method === 'OPTIONS') {
		res.writeHead(200);
		res.end();
		return;
	}

	var contentType = 'text/html';

	if (xpath === '/login') {

		var state = generateRandomString(16);

// 		//create a cookies object and assign random string as key/'
		var cookies = new Cookies(req, res, {keys: state});

		// Get a cookie
		var userKey = cookies.get('userKey');
		var userToken = cookies.get('userToken');

		if (!userKey) {
			//No userkey, set userkey to cookie
			console.log('````````````````FIRST VISIT`````````````````````````');
			cookies.set('userKey', cookies.keys);
			userKey = cookies.keys;
			// console.log(userKeyAndTokens);

			// your application requests authorization (API scope)
			var scope = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state';
			res.writeHead(301, {
				Location: 'https://accounts.spotify.com/authorize?' +
					qs.stringify({
						response_type: 'code',
						client_id: client_id,
						scope: scope,
						// expires_in: 3,
						redirect_uri: redirect_uri,
						state: userKey
					})
			});
			res.end("", 'utf-8');
		} else {
			//already has userKey
			console.log('----already has user key----' + userKey);

		}

	} else if (xpath === '/callback') {
		// your application requests refresh and access tokens
		// after checking the state parameter

		var code = query.code || null;
		var state = query.state || null;
//		var storedState = req.cookies ? req.cookies[stateKey] : null;
		var storedState = state;

		if (state === null || state !== storedState) {
			res.redirect('/#' +
				queryData.stringify({
					error: 'state_mismatch'
				}));
		} else {
//			res.clearCookie(stateKey);

			var authOptions = {
				url: 'https://accounts.spotify.com/api/token',
				form: {
					code: code,
					redirect_uri: redirect_uri,
					grant_type: 'authorization_code'
				},
				headers: {
					// 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))--new Buffer is deprecated! need to use Buffer.from instead
					'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')

				},
				json: true
			};

			request.post(authOptions, function (error, response, body) {
				if (!error && response.statusCode === 200) {

					console.log('-----------------callback-------------' + body.access_token);

					access_token = body.access_token;

					//add access token to cookies
					var cookies = new Cookies(req, res);
					var userKey = cookies.get('userKey');

					cookies.set('userToken', access_token);

					var userToken = cookies.get('userToken');


					// //update the userKeyAndTokens object---
					// if (userKey in userKeyAndTokens) {
					// 	userKeyAndTokens[userKey] = access_token;
					//
					// } else {
					// 	userKeyAndTokens[userKey] = access_token;
					//
					// }

					//try to insert userKey and userToken to SQLite3---make this a function

					var refresh_token = body.refresh_token;
					var selectQuery = "SELECT COUNT(*) FROM users WHERE userKey='" + userKey + "'";
					var insertQuery = "INSERT INTO users(userKey, userToken, refreshToken, userInfo, currentPlayingdata) VALUES (?,?,?,?,?)";
					// var updateQuery = "UPDATE users SET userToken='" + access_token + "', refreshToken='" + refresh_token + "', userInfo='', currentPlayingData='' WHERE userKey='" + userKey + "'";
					var paramsInsert = [userKey, access_token, refresh_token, null, null];

					insertDataToSQLite3(selectQuery, null, insertQuery, paramsInsert).then(function (message) {
						console.log('---664');
						console.log(message);

					}).catch(function (error) {
						console.log('--------652');
						console.log(error)
					});

					// insertUserInfo(userKey, userToken).then(function (message) {
					// 	console.log('627--userKey: ' + userKey + ' userToken: ' + userToken);
					// 	console.log(message)
					// }).catch(function (error) {
					// 	console.log('--------630');
					// 	console.log(error);
					// });
					// insertCurrentPlayContent(userKey, userToken).then(function (message) {
					// 	console.log('--------634')
					// 	console.log(message);
					// }).catch(function (error) {
					// 	console.log('--------637')
					// 	console.log(error);
					// });

					//when page redirect to callback, redirect page to userinfo.html--
					fs.readFile('./public/userinfo.html', function (error, content) {
						res.writeHead(200, {'Content-Type': contentType});
						res.end(content, 'utf-8');
					});


				} else {
					console.log(" request post error !");
					// console.log(body);
				}
			});
		}
	} else if (xpath === '/userdata') {
		var cookies = new Cookies(req, res);
		var userKey = cookies.get('userKey');
		// var userToken = cookies.get('userToken');


		getUserTokenFromSQL(userKey).then(function (message) {
			console.log('getUserTokenFromSQL is called successfully');
			// console.log(message);

			// if (typeof message !== "undefined") {
				//got user token from SQL successfully-
				//instead of get userInfo from the global array, need to get it from sqlite----
				getUserInfoFromSQL(userKey).then(function (msg) {
					console.log('getUserINFO FROM SQL-----------722');

					var string = msg.userInfo;
					if (msg.userInfo !== null) {
						// console.log(JSON.parse(removeslashes(string)));
						res.write(removeslashes(string));
						res.end();
					} else {
						//user info is null
						getUserTokenFromSQL(userKey).then(function (msg) {
							var token = msg.userToken;
							insertUserInfo(userKey, token).then(function (message) {
								console.log('!!!!!!!!!!!!---725');
								//after insert user info successfully, returned message is already an object, just need to make it into a JSON string. Can't use removeslashes(message);
								res.write(JSON.stringify(message));
								res.end();
							});
						}).catch(function (err) {
							console.log(err);
						});
					}

					// return message;
				}).catch(function (err) {
					console.log(err);
				});
			// }
			// else {
			// 	res.write(JSON.stringify( {"error" : "please authenticate again."} ));
			// 	res.end();
			// }
		}).catch(function (err) {
			console.log(err);
			// if failed to get userTokenFromSQL, make user authenticate again
			res.write(JSON.stringify( {"error" : "There is no such userKey in database, please authenticate again!"} ));
			res.end();
		});


	} else if (xpath === '/userCurrentPlayingData') {
		var cookies = new Cookies(req, res);
		var userKey = cookies.get('userKey');
		// var userToken = cookies.get('userToken');

		getUserTokenFromSQL(userKey).then(function (message) {
			//update currentplayingdata in sqlite
			insertCurrentPlayContent(userKey, message.userToken).then(function (message) {

				getSongLyrics(message.item.name, message.item.artists[0].name).then(function (getLyricsMsg) {
					console.log('got lyrics successfully-----812');
					// console.log(getLyricsMsg);
					res.write(JSON.stringify(Object.assign(message, getLyricsMsg)));
					res.end();

				}).catch(function (err) {
					console.log('Get lyrics failed, get current display data from SQL again!');
					getCurrentPlayDataFromSQL(userKey).then(function (msg) {
						console.log('get currentplaydata FROM SQL-----------769');
						// console.log(msg);
						var string = msg.currentPlayingData;
						// console.log(JSON.parse(removeslashes(string)));
						res.write(removeslashes(string));
						res.end();
					}).catch(function (err) {
						console.log('776--');
						// console.log(err);
					});

				});
				// return message;

			}).catch(function (err) {
				console.log('783-- insertCurrentPlayContentfailed----');
				// console.log(err);

				//insert failed means need to use refresh token to get new access token
				getRefreshTokenFromSQL(userKey).then(function (msg1) {
					// console.log('-----869 get refresh token from SQL');
					// console.log(msg);

					getNewAccessToken(msg1.refreshToken).then(function (new_access_token) {
						//use refreshToken to get new access token
						console.log('875 !!!!!');
						// console.log(new_access_token);
						// console.log(JSON.parse(M).access_token);
						var refreshed_access_token = JSON.parse(new_access_token).access_token;
						// console.log(refreshed_access_token);

						var selectQuery = "SELECT COUNT(*) FROM users WHERE userKey='" + userKey + "'";
						var updateQuery = "UPDATE users SET userToken='" + refreshed_access_token + "' WHERE userKey='" + userKey + "'";

						insertDataToSQLite3(selectQuery, updateQuery).then(function (message) {
							console.log('884- try to insert data to SQL');
							// console.log(message);
						}).catch(function (err) {
							console.log('804-');
							// console.log(err);
						});

						// insertCurrentPlayContent(userKey, refreshed_access_token).then(function (message) {
						// 	console.log('893--insert current play content with refresh access token.');
						// 	// console.log(refreshed_access_token);
						// 	// console.log(message.item.name);
						// 	// console.log(message.item.artists[0].name);
						//
						// 	getSongLyrics(message.item.name, message.item.artists[0].name).then(function (getLyricsMsg) {
						// 		console.log('got lyrics successfully-----');
						// 		// console.log(getLyricsMsg);
						// 		res.write(JSON.stringify(Object.assign(message, getLyricsMsg)));
						// 		res.end();
						//
						//
						// 	}).catch(function (err) {
						// 		console.log('Get lyrics failed, get current display data from SQL again!');
						// 		getCurrentPlayDataFromSQL(userKey).then(function (msg) {
						// 			console.log('get currentplaydata FROM SQL-----------769');
						// 			// console.log(msg);
						// 			var string = msg.currentPlayingData;
						// 			// console.log(JSON.parse(removeslashes(string)));
						// 			res.write(removeslashes(string));
						// 			res.end();
						// 		}).catch(function (err) {
						// 			console.log('776--');
						// 			res.write(JSON.stringify(err));
						// 			res.end();
						// 		});
						//
						// 	});
						//
						// 	//the name of the current playing song --- message.item.name
						// }).catch(function (err) {
						// 	console.log('899-');
						// 	console.log(err);
						// 	res.write(JSON.stringify(err));
						// 	res.end();
						// });

					}).catch(function (ErrorMsg) {
						console.log('get new access token failed');
						res.write(JSON.stringify(ErrorMsg));
						res.end();
					});

				}).catch(function (err) {
					// failed to get refresh access token
					console.log('826-failed to get refresh token from SQL');
					res.write(JSON.stringify(err));
					res.end();
				});
				res.write(JSON.stringify(err));
				res.end();
			});
		}).catch(function (err) {
			console.log('getUserTokenFrom SQL failed-');
			res.write(JSON.stringify(err));
			res.end();
		});

	} else if (xpath === '/getLyrics') {
		//get lyrics

		console.log('************************************************getLyrics');

	} else if (xpath === '/play') {
		console.log('try to play music');
		var cookies = new Cookies(req, res);
		var userKey = cookies.get('userKey');
		var userToken = cookies.get('userToken');

		getUserTokenFromSQL(userKey).then(function (msg) {
			//get valid access token to control player
			playerFuncs(msg.userToken, 'PUT', 'play');

		}).catch(function (err) {
			console.log(err);
		});

	} else if (xpath === '/pause') {
		var cookies = new Cookies(req, res);
		var userKey = cookies.get('userKey');
		var userToken = cookies.get('userToken');
		console.log('try to pause music');
		getUserTokenFromSQL(userKey).then(function (msg) {
			playerFuncs(msg.userToken, 'PUT', 'pause');
		}).catch(function (err) {
			console.log(err);
		});


	} else if (xpath === '/previous') {
		var cookies = new Cookies(req, res);
		var userKey = cookies.get('userKey');
		var userToken = cookies.get('userToken');
		console.log('try to play previous song');
		getUserTokenFromSQL(userKey).then(function (msg) {
			playerFuncs(msg.userToken, 'POST', 'previous');

		}).catch(function (err) {
			console.log(err);
		});


	} else if (xpath === '/next') {
		var cookies = new Cookies(req, res);
		var userKey = cookies.get('userKey');
		var userToken = cookies.get('userToken');
		console.log('try to play next song');
		getUserTokenFromSQL(userKey).then(function (msg) {
			playerFuncs(msg.userToken, 'POST', 'next');

		}).catch(function (err) {
			console.log(err);
		});


	} else if (xpath === '/clearCookies') {

		var cookies = new Cookies(req, res);
		cookies.set('userKey', '', '');
		cookies.set('userToken', '', '');
		res.write(JSON.stringify( {"result" : "success"}));
		res.end();

	}
	else if (xpath === "/") {
		var cookies = new Cookies(req, res);
		var userKey = cookies.get('userKey');
		var userToken = cookies.get('userToken');
		//writing a check for cookies when page is loaded----
		// console.log('906------'+userKey);

		if (userKey) {
			console.log('userKey---' + userKey);
			res.writeHead(301, {
				Location: site_url + '/userdata.html'
			});
			res.end();
		} else {
			console.log('!userKey' + userKey);
			fs.readFile('./public/index.html', function (error, content) {

				res.writeHead(200, {'Content-Type': contentType});
				res.end(content, 'utf-8');
			});
		}


	} else {
		var cookies = new Cookies(req, res);
		var userKey = cookies.get('userKey');
		var userToken = cookies.get('userToken');

		var filePath = "";

		if (xpath.indexOf(".") === -1) {
			filePath = "./public" + xpath + "/index.html";
		} else {
			filePath = './public' + xpath; // req.url;

		}

		if (filePath.indexOf('index.' === -1)) {
			if (userKey === undefined || userToken === undefined) {
				res.writeHead(301, {
					Location: '/'
				});
				return res.end();
			} else {
				console.log('UserKeyCookie: ' + userKey + '  UserTokenCookie:' + userToken);
			}
		} else {
			console.log(filePath);
		}

		var extname = path.extname(xpath);
		switch (extname) {
			case '.js':
				contentType = 'text/javascript';
				break;
			case '.css':
				contentType = 'text/css';
				break;
			case '.json':
				contentType = 'application/json';
				break;
			case '.gif':
				contentType = 'image/gif';
				break;
			case '.png':
				contentType = 'image/png';
				break;
			case '.jpg':
				contentType = 'image/jpg';
				break;
			case '.mp3':
				contentType = 'audio/mpeg';
				break;
			case '.mp4':
				contentType = 'video/mp4';
				break;
			case '.wav':
				contentType = 'audio/wav';
				break;
			case '.ttf':
				contentType = 'application/x-font-ttf';
				break;
			case '.otf':
				contentType = 'application/x-font-opentype';
				break;
			case '.woff':
				contentType = 'application/font-woff';
				break;
			case '.woff2':
				contentType = 'application/font-woff2';
				break;
			case '.eot':
				contentType = 'application/vnd.ms-fontobject';
				break;
			case '.svg':
				contentType = 'image/svg+xml';
				break;
			case '.zip':
				contentType = 'application/zip';
				break;
		}

		fs.readFile(filePath, function (error, content) {

			console.log('-----1117-----');
			console.log(filePath);
			if (error) {
				if (error.code == 'ENOENT') {
					console.log(filePath + " doesnt exist (2).");
					fs.readFile('./public/404.html', function (error, content) {
						res.writeHead(404, {'Content-Type': contentType});
						res.end(content, 'utf-8');
					});
				} else {
					console.log(filePath + " doesnt exist (3).");
					res.writeHead(500);
					res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
					res.end();
				}
			} else {

				res.writeHead(200, {
					'Content-Type': contentType,
					'Expires': 'Mon, 10 Oct 1977 00:00:00 GMT',
					'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate',
					'Pragma': 'no-cache',
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Request-Method': '*',
					'Access-Control-Allow-Methods': 'OPTIONS, GET',
					'Access-Control-Allow-Headers': '*'
				});
				res.end(content, 'utf-8');
			}
		});
	}
});