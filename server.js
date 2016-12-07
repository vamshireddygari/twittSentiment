var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var AlchemyLanguageV1 = require('watson-developer-cloud/alchemy-language/v1');
var Consumer = require('sqs-consumer');
var router = express.Router();
var S = require('string');

var Twitter = require('twit');

var elasticsearch = require('elasticsearch');

var globalSocket;



var alchemy = new AlchemyLanguageV1({
    api_key: ''
});


var aws = require('aws-sdk');
var aws_access_key_id = '';
var aws_secret_access_key = '';
var awsRegion = '';


aws.config.update({
    accessKeyID: aws_access_key_id,
    secretAccessKey: aws_secret_access_key,
    region: awsRegion
});


sqs = new aws.SQS();
sns = new aws.SNS();



app.use(express.static('public'));

app.get('/', function(req, res){
	res.sendfile(__dirname + '/index.html');

});


app.use('/', router);



app.set('port', process.env.PORT || process.env.VCAP_APP_PORT || 5000);


server.listen(app.get('port'), function() {
    console.log('Express Server started on port: ' + app.get('port'));
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));

// Errors
app.use(function(req, res, next) {
    var err = new Error('404: Specified URL Not Found');
    err.status = 404;
    next(err);
});

// Error Handler
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    return res.status(500).json(err.message);
});





var client = new elasticsearch.Client({
         host: 'https://search-twitttrends-gnrvmhwnpizu2wj5n2w6of7vr4.us-west-2.es.amazonaws.com/',
         log: 'trace'
         });


sns.subscribe({
        Protocol: 'http',
        //You don't just subscribe to "news", but the whole Amazon Resource Name (ARN)
        TopicArn: 'arn:aws:sns:us-west-2:119829000800:twittsenti',
        Endpoint: 'http://twitttrendebs-env.us-west-2.elasticbeanstalk.com/testr'
    }, function(error, data) {
        console.log(error || data);
});


router.all('/testr', function(req, res) {

  
      var msgBody = '';
  
      req.on('data', function(data){
        msgBody += data;
      });

      req.on('end', function(data){


        var msgData = JSON.parse(msgBody);
        var msgType = req.headers['x-amz-sns-message-type'];

        handleIncomingMessage(msgType, msgData);

      });
  



 });


function handleIncomingMessage(msgType, msgData) {
    if (msgType == 'SubscriptionConfirmation') {
        //confirm the subscription.
        sns.confirmSubscription({
            Token: msgData.Token,
            TopicArn: msgData.TopicArn
        });
    } else if (msgType == 'Notification') {

        console.log("Notification has arrived");

        
        
        var temp = JSON.parse(msgData.Message);


        var twit = {"username":temp.username ,"text": temp.text, "latitude": temp.latitude, "longitude": temp.longitude, "sentiment": temp.sentiment};



        client.index({
          index: 'twittmaps',
          type: 'twittmaps',
          id: temp.id,
          body: twit
      }, function (error, response) {

      });


        globalSocket.emit('toggle', twit);



    } else {
        console.log('Unexpected message type ' + msgType);
    }
}





/*server.listen(3000, function(){
  console.log('listening on *:3000');
});*/



function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7000; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}







var twittr = new Twitter({
  consumer_key: '',
  consumer_secret: '',
  access_token: '',
  access_token_secret: ''
}
);


var trackitems = {
          track : ''
        };

var stream = twittr.stream('statuses/filter', trackitems);;




  
io.on('connection', function (socket) {

  globalSocket = socket;

	console.log('user connected');
  
  socket.on('my other event', function (data) {

      if(stream != null)
      {
        stream.stop();
      }

  		  console.log('arjun');
        console.log(data);
        console.log(data.key);
         var key = data.key;

         console.log("user input :" + " " + key);

        // trackitems = [key];
        trackitems = {
          track : ''
        };




        trackitems.track = key;

        console.log(trackitems);

        getOldTweets(key);
        // twittr.track(key);

        stream = twittr.stream('statuses/filter', trackitems);

        stream.on('tweet', function(tweet) {
        
          if(tweet.place != null && tweet.lang == "en")
          {

      
                  
                  console.log(tweet.text + tweet.user.location);

                  var esinp={"id":tweet.id, "username":tweet.user.screen_name ,"text": tweet.text, "latitude": tweet.place.bounding_box.coordinates[0][0][1], "longitude": tweet.place.bounding_box.coordinates[0][0][0], "sentiment": ""};

                  sqsQueue(esinp);

                
          }
        
        }); 

  
  
        stream.on('error', function(error) {
          console.log(error);
          
        });

  });

});


function sqsQueue(tweet) {
    var params = {
        MessageBody: JSON.stringify(tweet),
        QueueUrl: "https://sqs.us-west-2.amazonaws.com/119829000800/twittSenti",
        DelaySeconds: 2
    };

    sqs.sendMessage(params, (err, result) => {
        if (err) {
            console.log('Error while putting in the queue', err);
        } else {
            console.log('Finished putting in the queue:');
        }
    });

    sentimentAnalysis();
}


function getOldTweets(word){

  client.search({
        from: 0,
        size: 200,
        index: 'twittmaps',
        type: 'twittmaps',
        body: {
            query: {
                match: {
                    text: word
                }
            }
        }
    }).then(function (resp) {
        // var hits = resp.hits.hits._source;

        response = resp.hits.hits

        for (i=0;i<response.length;i++)
        {
          var temp = response[i]._source;
          console.log(typeof temp);
          globalSocket.emit('oldtweets', temp)
        }
  
      }, function (err) {
        console.trace(err.message);
  });
}



function sentimentAnalysis() {

  var app = Consumer.create({
        queueUrl: "https://sqs.us-west-2.amazonaws.com/119829000800/twittSenti",
        region: awsRegion,
        batchSize: 10,
        handleMessage: function(message, done) {

            var msgBody = JSON.parse(message.Body);
            getSentiment(msgBody);
            return done();

        }
               
    });

    app.on('error', function(err) {
        console.log('error occured while getting tweets from queue');
    });

    app.start();
}


function getSentiment(params) {
  
    var msg = {
        text: ''
    };
    msg.text = JSON.stringify(params.text);
    alchemy.sentiment(msg, function(err, response) {
        if (err)
        {
            console.log('error:', err);
        }
        else {
            
            var senti = JSON.stringify(response.docSentiment.type, null, 2);
            params.sentiment = JSON.parse(senti);

            publishToSns(params);
            // emitTweets(params.latlong);// Function to emit tweets to front end
        }
    });

}


function publishToSns(message) {


    var payload = {
        default: JSON.stringify(message)
    };

    
    sns.publish({
        Message: JSON.stringify(payload),
        MessageStructure: 'json',
        TopicArn: 'arn:aws:sns:us-west-2:119829000800:twittsenti'
    }, function(err, data) {
        if (err) {
            console.log(err.stack);
            return;
        }
        else
        {  
        console.log("-----------------------SNS Publish-----------------------"); 
        console.log(data);
        
        }
    });
}


