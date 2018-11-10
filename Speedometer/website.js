
"use strict";								//defines nodejs mode to strict mode
var http = require('http'),						//including http library
fs = require('fs');							//name for fs to be used later
let express = require('express');					//includes express library
let app = express();							//name for express to be used later
let serverPort = 5000;							//defines port for webserver
let serialPortRecieve = '/dev/ttyUSB0';					//defines serial port to used as recieve port
let serialPortSend = '/dev/ttyACM0';					//defines serial port to used as send port
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: false }));			//Sets app to use bodyparser for post requests
app.use(bodyParser.json());						//sets app to use json body parser

var data = fs.readFileSync('savedData.json');				//reads savedData.json synchronously
var dataBackup = fs.readFileSync('savedDataBackup.json');		//reads savedDataBackup.json synchronously
var values;								//variable for values

var regex = new RegExp("{.*}");						//regular express to match any JSON string

if(regex.test(data)) values = JSON.parse(data);				//tests if there is any json data in savedData.json file and uses that is there is data
else if (regex.test(dataBackup)) values = JSON.parse(dataBackup);	//tests if there is any json data in backup file and if there is uses that data if savedData.json file is empty
else throw new Error('Cannot read files');				//throws error

app.listen(serverPort, function(){});					//starts listening to given port


let serialport = require('serialport');					//including serialport library
let portRecieve = new serialport(serialPortRecieve, {			//defines serial port to recieve data from arduino
    baudRate: 115200
});

let portSend = new serialport(serialPortSend, {				//defines serial port to send data to
    baudRate: 115200
});


const ReadLine = require('@serialport/parser-readline');		//defines ReadLine to use with parser
let parser = portRecieve.pipe(new ReadLine({ delimiter: '\r\n' }));	//defines parser to use to parse serial data

//function is called every time serial recieves data
parser.on('data', function(data) {
	data = JSON.parse(data);					//parses json string into json object
	values.speed = data.speed;					//sets value of speed
	values.fuel = data.fuel;					//sets value of fuel
	values.turning = data.turning;					//sets value of turning
	values.temp = data.temp;					//sets value of temp
	if 	(values.lightState == "fogLong" && data.light == "normal") values.lightState = "fogNormal";	//arduino gives "normal" or "long" values of lightState.
	else if (values.lightState == "fogNormal" && data.light == "long") values.lightState = "fogLong";	//Checks if lightState is already fog one. then changes 
	else if (values.lightState == "fogNormal" && data.light == "normal") values.lightState = "fogNormal";	//light state acording what arduino gives. for example
	else if (values.lightState == "fogLong" && data.light == "long") values.lightState = "fogLong";		//arduino gives long lightstate and lightstate is fogNormal
	else {values.lightState = data.light;}									//then lightState is changed to fogLong
});

//sends values to the output arduino every 100 milliseconds
setInterval(function writeSerial () {
	var data = {"lightState":"none","turning":"none"};		//creates new JSON object for data to be sent to arduino. Arduino doesnt need all the data
	data.lightState = values.lightState;				//sets current LightState to new JSON object
	data.turning = values.turning;					//set current turning to new JSON object
	data = JSON.stringify(data);					//stringify values to string
	if (portSend.isOpen) {						//opening serial port
        	portSend.write(data, function(err, res) {		//writes data to serial
                	if (err) { console.log(err); }			//if there is an error throws error
		});
    	}
}, 100);

//reads index.html file and serves it as an main webpage
fs.readFile('./index.html', function (err, html) {
    if (err) {								//if there is an error it closes the node
        throw err;
    }
	app.get('/', function(req,res) {
		res.header('Content-type', 'text/html');		//sets http request header to "text/html"
		return res.end(html);					//sends index.html file
	})
});

//creates /api/data webpage to serve json values to main website
app.get('/api/data', function (req, res) {
	res.end(JSON.stringify(values));				//stringify values to json string that is sent as and response when http request is made to /api/data website
});

//creates /api/recieve webpage where you can post data
app.post('/api/recieve', function (req, res) {
	values.lightState = req.body.lightState;			//sets lightState to post body (change between fog and no fog lights
});

//saves values to savedData.json every second and calculates trip from speed
setInterval(function(){
	values.trip += (values.speed / 3.6) / 1000;			//adds to trip how many meters have been travelled in one second
        var data = JSON.stringify(values);				//stringify values to string
	fs.writeFile('savedData.json', data, function(){});		//store values to savedData.json file
}, 1000);


//saves values to backup every 10 seconds in case of powering off raspberry while writing to savedData.json
setInterval(function(){
	var data = JSON.stringify(values);				//stringify values to string
	fs.writeFile('savedDataBackup.json', data, function(){});	//stores values to savedDataBackup.json file
}, 10000);
