var fs = require("fs"),
	path = require('path'),
	http = require("http"),
	url = require("url"),
	util = require("util"),
	qs = require("querystring");


var request = require('request'); // "Request" library
var Cookies = require('cookies'); //cookies module
var Promise = require('promise'); //
const sqlite3 = require('sqlite3'); //sqlite3 module


var client_id = '67200a417bd943a8b4f2f89360381546'; // Your client id
var client_secret = '28857a674b2d42da9600d90e05b8527f'; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri
var access_token = null;
var userData = null;
var userCurrentPlayingData = null;
var userKeyAndTokens = {};

var userCurrentPlayingDataArray = [];
var userDataArray = [];

//open database------
const db_path = 'database.db';
const db = new sqlite3.Database(db_path, (err) => {
	if (err) {
		return console.error(err.message);
	}

	console.log('Connected to ' + db_path + ' SQlite database.');

});

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

		request.post( options, function (error, response, body) {
			if( response.statusCode === 200){

				console.log('got refreshed access token!');
				resolve(body);

			}else{
				console.log('get refreshed access token failed');
				reject(body);
			}
		});
	});

};

var insertDataToSQLite3 = function (selectQ, updateQ, insertQ, insertParams) {
//try to insert userKey and userToken to SQLite3
	return new Promise(function (resolve, reject) {
		if (insertQ !== undefined && insertParams !== undefined) {
			db.all(selectQ, function (err, rows) {
				// console.log(rows);
				// console.log('------SELECT QUERY---------' + selectQ);
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
								reject('line 65')
							} else {
								// console.log('inserted row--' + insertQ);
								resolve('inserted row---' + insertQ);
							}
						});
					} else {
						//userKey already exist, need to update userToken!
						// console.log(rows);
						db.run(updateQ, [], function (err, rows) {
							if (err) {
								reject(err);
								reject('line 76');
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
								reject('line 98');
								// console.log(updateQ);
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

var insertUserInfo = function (userKey, access_token) {

	return new Promise(function (resolve, reject) {
		var options = {
			url: 'https://api.spotify.com/v1/me',
			headers: {'Authorization': 'Bearer ' + access_token},
			json: true
		};

		// use the access token to access the Spotify Web API
		request.get(options, function (error, response, body) {

			if( response.statusCode !== 200 ){
				console.log('get request failed----' + access_token);
				console.log(error);
				console.log(body);
				reject(body);

				// getRefreshTokenFromSQL(userKey).then(function (message) {
				// 	console.log('get refresh access token');
				//
				// 	getNewAccessToken(message['refreshToken']);
				//
				// }).catch(function (message) {
				// 	console.log('get refresh access token-failed!');
				// 	console.log(message);
				// });

			}else{
				console.log('get user info function------------');
				// console.log(body['error']['message']);

				//get refresh token from database
				// getNewAccessToken();
				//get user request has error, need to send refresh token

				userDataArray[access_token] = body;


				var selectQuery = "SELECT COUNT(*) FROM users WHERE userKey='" + userKey + "'";
				var updateQuery = "UPDATE users SET userInfo='" + addslashes(JSON.stringify(body)) + "' WHERE userKey='" + userKey + "'";

				insertDataToSQLite3(selectQuery, updateQuery);
				resolve(body);


			}

			// if (userKey !== undefined && access_token !== undefined) {
			// 	resolve(
			// 		insertDataToSQLite3(selectQuery, updateQuery)
			// 	);
			// } else {
			// 	reject('Failed!');
			// }

		});
	});
};

var getRefreshTokenFromSQL = function (userKey) {

	return new Promise(function (resolve, reject) {
		var selectQuery = "SELECT refreshToken FROM users WHERE userKey='" + userKey + "'";


		db.get(selectQuery, [], function (err, rows) {
			if (err) {
				reject(err);
			} else {
				resolve(rows);
			}
		});
	});

};

var selectCurrentPlayDataFromSQL = function (userKey) {

	return new Promise(function (resolve, reject) {
		var selectQuery = "SELECT currentPlayingData FROM users WHERE userKey='" + userKey + "'";


		db.get(selectQuery, [], function (err, rows) {
			if (err) {
				reject(err);
			} else {
				resolve(rows);
			}
		});
	});

};

var selectUserInfoFromSQL = function (userKey) {

	return new Promise(function (resolve, reject) {
		var selectQuery = "SELECT userInfo FROM users WHERE userKey='" + userKey + "'";

		db.get(selectQuery, [], function (err, rows) {
			if (err) {
				reject(err);
			} else {
				resolve(rows);
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

			// userCurrentPlayingDataArray[access_token] = body;

			// console.log((JSON.stringify(body)));
			// console.log('-------');

			if(error){
				console.log('get request failed');
				console.log(error);
			}else{
				console.log('get user info function------------');
				// console.log(content);

				// console.log(body['error']);
				if( "error" in body ){
					reject(body);

				}else{
					userCurrentPlayingDataArray[access_token] = body;
					console.log('get current playing info function------------');

					var selectQuery = "SELECT COUNT(*) FROM users WHERE userKey='" + userKey + "'";
					var updateQuery = 'UPDATE users SET currentPlayingData="' + addslashes(JSON.stringify(body)) + '" WHERE userKey="' + userKey + '"';

					resolve(
							insertDataToSQLite3(selectQuery, updateQuery),
							console.log('!!!!')
						);

				}

			}

			// //insert currentplayingdata to sqlite3
			// var selectQuery = "SELECT COUNT(*) FROM users WHERE userKey='" + userKey + "'";
			// var updateQuery = 'UPDATE users SET currentPlayingData="' + addslashes(JSON.stringify(body)) + '" WHERE userKey="' + userKey + '"';
			//
			// if (userKey !== undefined && access_token !== undefined) {
			// 	resolve(
			// 		insertDataToSQLite3(selectQuery, updateQuery),
			// 		console.log('!!!!')
			// 	);
			// } else {
			// 	reject('inser currect play content to SQL failed!');
			// }

			// userCurrentPlayingData = body;
			// console.log('get current play song-------------');
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

	if (action === "play") {

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
	}


	if (method === 'GET') {
		request.get(options, function (error, content, body) {
			console.log('========GET=========');
			if (action === '') {
				userCurrentPlayingDataArray[access_token] = body;
				// userCurrentPlayingData = body;
			}
		});
	} else if (method === 'POST') {
		request.post(options, function (error, content, body) {
			console.log('---------------POST------------');
			// console.log(body);
		});
	} else if (method === 'PUT') {


		request.put(options, function (error, content, body) {
			console.log('---------------PUT--------------');
			// console.log(body);
		});

	}
};

var stateKey = 'spotify_auth_state';


process.on('exit', (code) => {
	console.log('About to exit with code:', code);
});


var server = http.createServer(function (req, res) {

	// console.log(req.url);
	var queryData = url.parse(decodeURIComponent(req.url), true);
	// console.log(queryData);

	const xpath = queryData.pathname, query = queryData.query;
	const method = req.method;

	// console.log("Request received on: " + xpath + " method: " + method + " query: " + JSON.stringify(query));

	if (req.method === 'OPTIONS') {
		res.writeHead(200);
		res.end();
		return;
	}

	var contentType = 'text/html';

	var cookies = new Cookies(req, res);
	var userKey = cookies.get('userKey');
	var userToken = cookies.get('userToken');





	if (xpath === '/login') {
		console.log('3');

		var state = generateRandomString(16);
//		res.cookie(stateKey, state);

// 		//create a cookies object
		var cookies = new Cookies(req, res, {keys: state});

		// Get a cookie
		var userKey = cookies.get('userKey');
		var userToken = cookies.get('userToken');


		console.log(userKey + '--------userKey!----');


		var scope = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state';

		if (!userKey) {
			//hasn't have userkey, set userkey to cookie
			console.log('````````````````FIRST VISIT`````````````````````````');
			cookies.set('userKey', cookies.keys);

			// cookies.set('userToken', access_token);
			userKey = cookies.keys;
			console.log(userKeyAndTokens);


		} else {
			//already has userKey
			console.log('----already has user key----' + userKey);

		}

		// your application requests authorization
		var scope = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state';
		res.writeHead(301, {
			Location: 'https://accounts.spotify.com/authorize?' +
				qs.stringify({
					response_type: 'code',
					client_id: client_id,
					scope: scope,
					redirect_uri: redirect_uri,
					state: userKey
				})
		});

		res.end("", 'utf-8');

	} else if (xpath === '/callback') {


		// your application requests refresh and access tokens
		// after checking the state parameter

		var code = query.code || null;
		var state = query.state || null;
//		var storedState = req.cookies ? req.cookies[stateKey] : null;
		var storedState = state;

		if (state === null || state !== storedState) {
			res.redirect('/#' +
				querystring.stringify({
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

					console.log('-----------------callback-------------');
					// console.log(body);

					access_token = body.access_token;

					//add access token to cookies
					var cookies = new Cookies(req, res);
					var userKey = cookies.get('userKey');

					cookies.set('userToken', access_token);

					var userToken = cookies.get('userToken');


					//update the userKeyAndTokens object---
					if (userKey in userKeyAndTokens) {
						userKeyAndTokens[userKey] = access_token;

					} else {
						userKeyAndTokens[userKey] = access_token;

					}


					insertUserInfo(userKey, userToken);
					insertCurrentPlayContent(userKey, userToken);

					//try to insert userKey and userToken to SQLite3---make this a function

					var refresh_token = body.refresh_token;
					var selectQuery = "SELECT COUNT(*) FROM users WHERE userKey='" + userKey + "'";
					var insertQuery = "INSERT INTO users(userKey, userToken, refreshToken, userInfo, currentPlayingdata) VALUES (?,?,?,?,?)";
					var updateQuery = "UPDATE users SET userToken='" + access_token + "', refreshToken='" + refresh_token + "', userInfo='" + userDataArray[access_token] + "', currentPlayingData='" + userCurrentPlayingDataArray[access_token] + "' WHERE userKey='" + userKey + "'";
					var paramsInsert = [userKey, access_token, refresh_token, userDataArray[access_token], userCurrentPlayingDataArray[access_token]];

					insertDataToSQLite3(selectQuery, updateQuery, insertQuery, paramsInsert);


					//when page redirect to callback, redirect page to userinfo.html--
					fs.readFile('./public/userinfo.html', function (error, content) {
						res.writeHead(200, {'Content-Type': contentType});
						res.end(content, 'utf-8');
					});


				} else {
					console.log(" request post error !");
					console.log(body);
				}
			});
		}
	} else if (xpath === '/userdata') {
		var cookies = new Cookies(req, res);
		var userKey = cookies.get('userKey');
		var userToken = cookies.get('userToken');

		console.log('699---------'+userToken);
		if (userToken !== undefined && userToken !== '') {

			//instead of get userInfo from the global array, need to get it from sqlite----

			//update userInfo in array and sqlite
			insertUserInfo(userKey, userToken).then(function (message) {
				console.log('insert user info 716 success--');
				console.log(message);

				//insert user info success----so try to get user info from SQL.
				selectUserInfoFromSQL(userKey).then(function (msg) {
					console.log('getUserINFO FROM SQL-----------722');
					console.log(msg);
					var string = msg.userInfo;
					console.log(JSON.parse(removeslashes(string)));
					res.write(removeslashes(string));
					res.end();
				}).catch(function (msg) {
					console.log('728 failed to select user info from SQL');
					console.log(msg);
				});

				return message;

			}).catch(function (msg) {
				console.log('735--insert user info failed----');
				console.log(msg);
				//insert failed means need to use refresh token to get new access token
				getRefreshTokenFromSQL(userKey).then(function (msg) {
					console.log('-----739');

					console.log(msg);

					getNewAccessToken(msg.refreshToken).then(function (new_access_token) {
						console.log('744 !!!!!');
						// console.log(JSON.parse(M).access_token);
						var refreshed_access_token = JSON.parse(new_access_token).access_token;
						console.log(refreshed_access_token);

						var selectQuery = "SELECT COUNT(*) FROM users WHERE userKey='" + userKey + "'";
						var updateQuery = "UPDATE users SET userToken='" + refreshed_access_token + "' WHERE userKey='" + userKey + "'";

						insertDataToSQLite3(selectQuery, updateQuery).then(function (message) {
							console.log('753-');
							console.log(message);
						}).catch(function (message) {
							console.log('756-');
							console.log(message);
						});


						insertUserInfo(userKey, refreshed_access_token).then(function (message) {
							console.log('762-');
							console.log(message);
							res.write(JSON.stringify(message));
							res.end();
						}).catch(function (message) {
							console.log('767-');
							console.log(message);
						});

					}).catch(function (ErrorMsg) {
						console.log(ErrorMsg);
					});

				}).catch(function (message) {
					// failed to get refresh access token
					console.log('786-failed to get refresh token from SQL');
					console.log(message);

				});
			});
			//====


			// //update userInfo in array and sqlite
			// insertUserInfo(userKey, userToken).then(function (message) {
			// 	console.log('isnert User INFO');
			// 	console.log(message);
			//
			// 	//try to get userData from database and write to page----
			// 	selectUserInfoFromSQL(userKey).then(function (msg) {
			// 		console.log('getUserINFO FROM SQL-----------------success');
			// 		var string = msg.userInfo;
			// 		console.log(JSON.parse(removeslashes(string))['error']);
			//
			// 		if(JSON.parse(removeslashes(string))['error'] !== undefined){
			// 			//has error---{ status: 401, message: 'The access token expired' }
			// 			//{ error: { status: 401, message: 'The access token expired' } }
			//
			// 			console.log(removeslashes(string)['error']);
			//
			// 			getNewAccessToken(userKey).then(function (message) {
			// 				console.log('select failedL');
			// 				console.log(message);
			// 			}).catch(function (message) {
			//
			// 			});
			//
			// 		}else{
			// 			// console.log(typeof removeslashes(string));
			// 			res.write(removeslashes(string));
			// 			res.end();
			// 		}
			//
			// 	}).catch(function (msg) {
			// 		console.log('getUserINFO FROM SQL--FAILED    ' + msg);
			// 	});
			//
			// 	// console.log('--------------' + message + '------553');
			// }).catch(function (message) {
			// 	console.log(message);
			// });

			//this part is for writing the page with data from the array!
			// if (userDataArray[userToken] !== undefined) {
			// 	// res.write(JSON.stringify(userDataArray[userToken]));
			// } else {
			//
			// }
			// res.end();

		} else {
			console.log('-------823');

			res.writeHead(301, {Location: 'http://localhost:8888'});

			res.end();

		}

	} else if (xpath === '/userCurrentPlayingData') {
		var cookies = new Cookies(req, res);
		var userKey = cookies.get('userKey');
		var userToken = cookies.get('userToken');

		//update current play content in array and sqlite
		// insertCurrentPlayContent(userKey, userToken);

		if (userToken !== undefined && userToken!== '') {
			// console.log(userCurrentPlayingData);
			//get current playing data from array
			// if (userCurrentPlayingDataArray[userToken] !== undefined) {
			// 	res.write(JSON.stringify(userCurrentPlayingDataArray[userToken]));
			// } else {
			//
			// }
			//
			// res.end();

			//get current playing data from array from SQLite3 after data is insert/updated to SQLite
			insertCurrentPlayContent(userKey, userToken).then(function (message) {

				selectCurrentPlayDataFromSQL(userKey).then(function (msg) {
					console.log('get currentplay data from SQLite-----success');
					var string = msg.currentPlayingData;

					res.write(removeslashes(string));
					res.end();

				}).catch(function (msg) {
					console.log('get currentplayingdata from SQLite failed!' + msg);
				});

			}).catch(function (message) {
				console.log(message);
			});


		} else {
			console.log('868`````');
			res.writeHead(301, {Location: 'http://localhost:8888'});
			res.end();
		}


	} else if (xpath === '/play') {
		console.log('try to play music');
		var cookies = new Cookies(req, res);
		var userToken = cookies.get('userToken');
		playerFuncs(userToken, 'PUT', 'play');


	} else if (xpath === '/pause') {
		console.log('try to pause music');
		var cookies = new Cookies(req, res);
		var userToken = cookies.get('userToken');
		playerFuncs(userToken, 'PUT', 'pause');

	} else if (xpath === '/previous') {
		var cookies = new Cookies(req, res);
		var userToken = cookies.get('userToken');
		console.log('try to play previous song');
		playerFuncs(userToken, 'POST', 'previous');

	} else if (xpath === '/next') {
		var cookies = new Cookies(req, res);
		var userToken = cookies.get('userToken');
		console.log('try to play next song');
		playerFuncs(userToken, 'POST', 'next');

	} else if (xpath === "/") {
		//writing a check for cookies when page is loaded----

		var cookies = new Cookies(req, res, {keys: state});
		var userKey = cookies.get('userKey');

		console.log('906------'+userKey);

		if(userKey){
			console.log('111')
			res.writeHead(301,{
				Location: 'http://localhost:8888/userdata.html'
			});
			res.end();
		}else{
			console.log('222')
			fs.readFile('./public/index.html', function (error, content) {

				res.writeHead(200, {'Content-Type': contentType});
				res.end(content, 'utf-8');
			});
		}


	} else {

		var filePath = "";

		if (xpath.indexOf(".") === -1) {
			filePath = "./public" + xpath + "/index.html";
		} else {
			filePath = './public' + xpath; // req.url;

		}

		if (filePath.indexOf("index.") === -1) {
			if (userToken !== undefined && userToken!== '') {
				// console.log(userCurrentPlayingData);
				//get current playing data from array
				// if (userCurrentPlayingDataArray[userToken] !== undefined) {
				// 	res.write(JSON.stringify(userCurrentPlayingDataArray[userToken]));
				// } else {
				//
				// }
				//
				// res.end();

				//get current playing data from array from SQLite3 after data is insert/updated to SQLite
				insertCurrentPlayContent(userKey, userToken).then(function (message) {

					selectCurrentPlayDataFromSQL(userKey).then(function (msg) {
						console.log('get currentplay data from SQLite-----success');
						var string = msg.currentPlayingData;

						res.write(removeslashes(string));
						res.end();

					}).catch(function (msg) {
						console.log('get currentplayingdata from SQLite failed!' + msg);
					});

				}).catch(function (message) {
					console.log(message);
				});


			} else {
				console.log('868`````');
				res.writeHead(301, {Location: 'http://localhost:8888'});
				res.end();
				return;
			}
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


server.listen(8888);
