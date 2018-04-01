/*******************************************************************************
* Copyright (c) 2015 IBM Corp.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*******************************************************************************/

var express = require('express')
  , http = require('http')
  , fs = require('fs')
  , log4js = require('log4js');
var settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));

var logger = log4js.getLogger('app');
logger.setLevel(settings.loggerLevel);

var app = express();
var morgan         = require('morgan');
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var cookieParser = require('cookie-parser')



// added for SSO
var passport = require('passport'); 
//var cookieParser = require('cookie-parser');
var session = require('express-session');
// disable process.env.PORT for now as it cause problem on mesos slave
var port = (process.env.VMC_APP_PORT || process.env.VCAP_APP_PORT || settings.port);
var host = (process.env.VCAP_APP_HOST || 'localhost');

logger.info("host:port=="+host+":"+port);

var authService;
var authServiceLocation = process.env.AUTH_SERVICE;
if (authServiceLocation) 
{
	logger.info("Use authservice:"+authServiceLocation);
	var authModule;
	if (authServiceLocation.indexOf(":")>0) // This is to use micro services
		authModule = "ITOCairhttp";
	else
		authModule= authServiceLocation;
	
	authService = new require('./'+authModule+'/index.js')(settings);
	if (authService && "true"==process.env.enableHystrix) // wrap into command pattern
	{
		logger.info("Enabled Hystrix");
		authService = new require('./ITOCaircmd/index.js')(authService, settings);
	}
}

var dbtype = process.env.dbtype || "mongo";

//Added for SSO
app.use(cookieParser());
app.use(session({resave: 'true', saveUninitialized: 'true' , secret: 'keyboard cat'}));
app.use(passport.initialize());
app.use(passport.session()); 

passport.serializeUser(function(user, done) {
   done(null, user);
}); 

passport.deserializeUser(function(obj, done) {
   done(null, obj);
});         

// VCAP_SERVICES contains all the credentials of services bound to
// this application. For details of its content, please refer to
// the document or sample of each service.  
var services = JSON.parse(process.env.VCAP_SERVICES || "{}");
var ssoConfig = services.SingleSignOn[0]; 
var client_id = ssoConfig.credentials.clientId;
var client_secret = ssoConfig.credentials.secret;
var authorization_url = ssoConfig.credentials.authorizationEndpointUrl;
var token_url = ssoConfig.credentials.tokenEndpointUrl;
var issuer_id = ssoConfig.credentials.issuerIdentifier;
var callback_url = 'https://ITOCair-nodejs-ecs.mybluemix.net/auth/sso/callback';        

var OpenIDConnectStrategy = require('passport-idaas-openidconnect').IDaaSOIDCStrategy;
var Strategy = new OpenIDConnectStrategy({
                 authorizationURL : authorization_url,
                 tokenURL : token_url,
                 clientID : client_id,
                 scope: 'openid',
                 response_type: 'code',
                 clientSecret : client_secret,
                 callbackURL : callback_url,
                 skipUserProfile: true,
                 issuer: issuer_id}, 
	function(iss, sub, profile, accessToken, refreshToken, params, done)  {
	         	process.nextTick(function() {
		profile.accessToken = accessToken;
		profile.refreshToken = refreshToken;
		done(null, profile);
         	})
}); 

passport.use(Strategy); 
app.use(ensureAuthenticated);
app.get('/login', passport.authenticate('openidconnect', {})); 
          
function ensureAuthenticated(req, res, next) {
if(!req.isAuthenticated() && !req.path.indexOf('/login') == 0 
             && !req.path.indexOf('/auth') == 0 ) 
          {	

console.log("The URL is "+req.originalUrl);		  
	     req.session.originalUrl = req.originalUrl;		 
console.log("The session URL is "+req.session.originalUrl);		  
		 
             res.redirect('/login');
	  } 
          else
          {
	     return next();
 	  }
}


//Added for SSO
app.get('/auth/sso/callback',function(req,res,next) {               
 console.log("The callback session URL is "+req.session.originalUrl);
             var redirect_url = req.session.originalUrl;                
             passport.authenticate('openidconnect', {
                     successRedirect: redirect_url,                                
                     failureRedirect: '/failure',                        
          })(req,res,next);
        });
		
//Added for SSO
app.get('/failure', function(req, res) { 
             res.send('login failed'); });
			 
//Added for SSO
app.get('logout', function(req, res) {
          req.logout();
          res.redirect('https://' + issuer_id +
                  '/idaas/mtfim/sps/idaas/logout');
      });
	  
app.use(bodyParser.urlencoded({ extended: false }))

// Calculate the backend datastore type if run inside BLuemix or cloud foundry
if(process.env.VCAP_SERVICES){
	var env = JSON.parse(process.env.VCAP_SERVICES);
      	logger.info("env: %j",env);
	var serviceKey = Object.keys(env)[0];
	if (serviceKey && serviceKey.indexOf('cloudant')>-1)
		dbtype="cloudant";
	else if (serviceKey && serviceKey.indexOf('redis')>-1)
		dbtype="redis";
}
logger.info("db type=="+dbtype);

var routes = new require('./routes/index.js')(dbtype, authService,settings);
var loader = new require('./loader/loader.js')(routes, settings);

// Setup express with 4.0.0

//var app = express();
//var morgan         = require('morgan');
//var bodyParser     = require('body-parser');
//var methodOverride = require('method-override');
//var cookieParser = require('cookie-parser')

app.use(express.static(__dirname + '/public'));     	// set the static files location /public/img will be /img for users
if (settings.useDevLogger)
	app.use(morgan('dev'));                     		// log every request to the console

//create application/json parser
var jsonParser = bodyParser.json();
// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false });

app.use(jsonParser);
app.use(urlencodedParser);
//parse an HTML body into a string
app.use(bodyParser.text({ type: 'text/html' }));

app.use(methodOverride());                  			// simulate DELETE and PUT
app.use(cookieParser());                  				// parse cookie

var router = express.Router(); 		

router.post('/login', login);
router.get('/login/logout', logout);
router.post('/flights/queryflights', routes.checkForValidSessionCookie, routes.queryflights);
router.post('/bookings/bookflights', routes.checkForValidSessionCookie, routes.bookflights);
router.post('/bookings/cancelbooking', routes.checkForValidSessionCookie, routes.cancelBooking);
router.get('/bookings/byuser/:user', routes.checkForValidSessionCookie, routes.bookingsByUser);
router.get('/customer/byid/:user', routes.checkForValidSessionCookie, routes.getCustomerById);
router.post('/customer/byid/:user', routes.checkForValidSessionCookie, routes.putCustomerById);
router.get('/config/runtime', routes.getRuntimeInfo);
router.get('/config/dataServices', routes.getDataServiceInfo);
router.get('/config/activeDataService', routes.getActiveDataServiceInfo);
router.get('/config/countBookings', routes.countBookings);
router.get('/config/countCustomers', routes.countCustomer);
router.get('/config/countSessions', routes.countCustomerSessions);
router.get('/config/countFlights', routes.countFlights);
router.get('/config/countFlightSegments', routes.countFlightSegments);
router.get('/config/countAirports' , routes.countAirports);
//router.get('/loaddb', startLoadDatabase);
router.get('/loader/load', startLoadDatabase);
router.get('/loader/query', loader.getNumConfiguredCustomers);
router.get('/checkstatus', checkStatus);

if (authService && authService.hystrixStream)
	app.get('/rest/api/hystrix.stream', authService.hystrixStream);


//REGISTER OUR ROUTES so that all of routes will have prefix 
app.use(settings.contextRoot, router);

// Only initialize DB after initialization of the authService is done
var initialized = false;
var serverStarted = false;

if (authService && authService.initialize)
{
	authService.initialize(function(){
		initDB();
	});
}
else
	initDB();


function checkStatus(req, res){
	res.sendStatus(200);
}

function login(req, res){
	if (!initialized)
     {
		logger.info("please wait for db connection initialized then trigger again.");
		initDB();
		res.sendStatus(403);
	}else
		routes.login(req, res);
}

function logout(req, res){
	if (!initialized)
     {
		logger.info("please wait for db connection initialized then trigger again.");
		initDB();
		res.sendStatus(400);
	}else
		routes.logout(req, res);
}


function startLoadDatabase(req, res){
	if (!initialized)
     	{
		logger.info("please wait for db connection initialized then trigger again.");
		initDB();
		res.sendStatus(400);
	}else
		loader.startLoadDatabase(req, res);
}

function initDB(){
    if (initialized ) return;
		routes.initializeDatabaseConnections(function(error) {
	if (error) {
		logger.info('Error connecting to database - exiting process: '+ error);
		// Do not stop the process for debug in container service
		//process.exit(1); 
	}else
	      initialized =true;

	logger.info("Initialized database connections");
	startServer();
	});
}


function startServer() {
	if (serverStarted ) return;
	serverStarted = true;
	app.listen(port);   
	logger.info("Express server listening on port " + port);
}
