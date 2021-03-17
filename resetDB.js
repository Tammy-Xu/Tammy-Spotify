//open database------

var fs = require("fs");
const sqlite3 = require('sqlite3'); //sqlite3 module


const db_path = 'database.db';
var db;

fs.readFile(db_path, function (error, content) {
	console.log('can\'t find database.db file');

	if (error) {
		console.log('create database.db file now----');
		db = new sqlite3.Database(db_path, function (err) {
			if (err) {
				return console.error(err.message);
			} else {
				console.log('Connected to ' + db_path + ' SQlite database.');
				//create a blank user table

				db.run('CREATE TABLE IF NOT EXISTS "users" ( "ID" INTEGER NOT NULL, "userKey" TEXT NOT NULL, "userToken" TEXT, "refreshToken" TEXT, "userInfo" TEXT, "currentPlayingData" TEXT, PRIMARY KEY("ID") )', function (message) {
					console.log(message);
				});
				db.close();
			}
		});

	} else {
		console.log('remove original database file and create a new one!');
		fs.unlink(db_path, function (err) {
			if (err) {
				console.log(err);
				return
			} else {
				console.log('-----');
				db = new sqlite3.Database(db_path, function (err) {
					if (err) {
						return console.error(err.message);
					} else {
						console.log('Connected to ' + db_path + ' SQlite database.');
						//create a blank user table
						db.run('CREATE TABLE IF NOT EXISTS "users" ( "ID" INTEGER NOT NULL, "userKey" TEXT NOT NULL, "userToken" TEXT, "refreshToken" TEXT, "userInfo" TEXT, "currentPlayingData" TEXT, PRIMARY KEY("ID") )', function (message) {
							console.log(message);
						});
						db.close();
					}
				});
			}
		});
	}
});