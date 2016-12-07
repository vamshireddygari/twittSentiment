// Marker Coloring and other stuff
var pinColor = "00FF40";

var pinImage;
var pinShadow;

var map1;
var map2;
var table;

var markers = [];
var heatmap;

var socket;
var currentTag = "";

var initialTweets;

function initMap() {

    table = document.getElementById('tableBody');

    pinImage = new google.maps.MarkerImage("http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|" + pinColor,
        new google.maps.Size(21, 34),
        new google.maps.Point(0, 0),
        new google.maps.Point(10, 34));

    pinShadow = new google.maps.MarkerImage("http://chart.apis.google.com/chart?chst=d_map_pin_shadow",
        new google.maps.Size(40, 37),
        new google.maps.Point(0, 0),
        new google.maps.Point(12, 35));

    map1 = new google.maps.Map(document.getElementById('map'), {
        zoom: 2,
        center: new google.maps.LatLng(34.51, -94.16),
        mapTypeId: google.maps.MapTypeId.SATELLITE
    });


    map2 = new google.maps.Map(document.getElementById('heatmap'), {
        zoom: 2,
        center: {
            lat: 40.7127,
            lng: 74.005
        },
        mapTypeId: google.maps.MapTypeId.SATELLITE
    });


    var url = window.location.href;
    var arr = url.split("/");
    var socketIOUrl = arr[0] + "//" + arr[2];
    console.log(socketIOUrl);

    socket = io.connect(socketIOUrl);
    socket.on('connectionSuccessful', function(data) {});

    socket.on('initialTweets', function(tweets) {
        console.log(tweets);
        initialTweets = tweets;
        initMarkerMap();
        initHeatMap();
    });

    socket.on('initialTweetsByTag', function(tweets) {
        initialTweets = tweets;
        initMarkerMap();
        initHeatMap();

    });
}

function initMarkerMap() {

    for (var i = 0; i < markers.length; i++) {
        markers[i].setMap(null);
    }

    var marker;
    markers = [];

    table.innerHTML = "";


    for (i = 0; i < initialTweets.length; i++) {
        marker = new google.maps.Marker({
            position: {
                lat: initialTweets[i].latitude,
                lng: initialTweets[i].longitude
            },
            map: map1,
            shadow: pinShadow,
            animation: google.maps.Animation.DROP,
            title: initialTweets[i].name + "\n" + initialTweets[i].tweetTexts
        });
        markers.push(marker);

        table.innerHTML += generateTableRowHtml(initialTweets[i]);

    }

    socket.on('tweet', function(tweet) {

        console.log(tweet);
        if (currentTag && currentTag.toLowerCase() != tweet.keyword.toLowerCase()) {
            return;
        }

        var marker = new google.maps.Marker({
            position: {
                lat: tweet.latitude,
                lng: tweet.longitude
            },
            map: map1,
            icon: pinImage,
            animation: google.maps.Animation.BOUNCE,
            title: tweet.name + "\n" + tweet.tweetTexts
        });
        markers.push(marker);

        table.innerHTML += generateTableRowHtml(tweet);
    });

}

function generateTableRowHtml(tweet) {
    return "<tr>" +
        "<td>" + tweet.name + "</td>" +
        "<td>" + tweet.tweetTexts + "</td>" +
        "<td>" + tweet.keyword + "</td>" +
        "<td>" + tweet.language + "</td>" +
        "</tr>";
}


function initHeatMap() {

    if (heatmap) {
        heatmap.setMap(null);
    }

    var heatPoints = new google.maps.MVCArray([]);

    heatmap = new google.maps.visualization.HeatmapLayer({
        data: heatPoints,
        map: map2
    });

    for (var j = 0; j < initialTweets.length; j++) {
        heatPoints.push(new google.maps.LatLng(initialTweets[j].latitude, initialTweets[j].longitude));
    }

    socket.on('tweet', function(tweet) {
        if (currentTag && currentTag.toLowerCase() != tweet.keyword.toLowerCase()) {
            return;
        }
        heatPoints.push(new google.maps.LatLng(tweet.latitude, tweet.longitude));
    });
}

function updateTweetData(tag) {
    currentTag = tag;
    socket.emit('initialTweetsByTag', tag);
    return false;
}
