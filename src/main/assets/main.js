require.config({
  baseUrl: '/assets',
  paths: {
    'leaflet': 'leaflet-0.7.3/leaflet',
    'qajax': 'qajax.min'
  }
});

require(['leaflet', 'routes', 'qajax', 'el'], function (L, routes, qajax, el) {

  var ajax = function (endpoint, opts) {
    opts = opts || {};
    opts.url = endpoint.url;
    opts.method = endpoint.method;
    return qajax(opts)
      .then(qajax.filterSuccess)
      .then(qajax.toJSON);
  };

  var readCookie = function (name) {
    return decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent(name).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || null;
  };

  var writeCookie = function (name, value) {
    document.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value);
  };

  var whatSelect = document.getElementById('what');
  var whereInput = document.getElementById('where');
  var locateMeBtn = document.getElementById('locate-me');

  var map = L.map(document.getElementById('map'), { minZoom: 15 });
  L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  var state = {
    knownPois: [], // Coordinates of already known pois
    pois: null, // Layer showing pois
    myLocation: null // Marker showing my location
  };

  map.on('locationfound', function (e) {
    map.setView(e.latlng, 17);
    if (state.myLocation === null) {
      state.myLocation = L.circleMarker(e.latlng);
      state.myLocation.addTo(map);
    } else {
      state.myLocation.setLatLng(e.latlng);
    }
  });

  locateMeBtn
    .addEventListener('click', function () {
      map.locate();
    });

  whatSelect
    .addEventListener('change', function (e) {
      writeCookie('what', e.target.value);
      // TODO Remove pois and trigger search
    });

  whereInput.form
    .addEventListener('submit', function (e) {
      e.preventDefault();
      ajax(routes.closely.Controller.geocode(whereInput.value))
        .then(function (point) {
          map.setView([point.lat, point.lon], 17);
        }, function () {
          alert('Unable to find the given location')
        });
    });

  map.on('moveend', function () {
    writeCookie('location', [map.getCenter().lat, map.getCenter().lng, map.getZoom()].join('|'));
    var bounds = map.getBounds();
    // TODO Use a cache to read cookie
    ajax(routes.closely.Controller.search(readCookie('what'), {
      north: bounds._northEast.lat,
      east: bounds._northEast.lng,
      south: bounds._southWest.lat,
      west: bounds._southWest.lng
    }))
      .then(function (json) {
        json.elements
          .filter(function (e) { return state.knownPois.indexOf(e.id) === -1 })
          .forEach(function (e) {
            state.knownPois.push(e.id);
            L.marker([e.lat, e.lon])
              .bindPopup(el('ul')(
                Object.keys(e.tags || {}).map(function (tag) {
                  return el('li')(el('strong')(tag), ': ' + e.tags[tag])
                })
              ))
              .addTo(map);
          });
      })
  });

  var readWhat = readCookie('what');
  if (readWhat !== null) {
    whatSelect.value = readWhat;
  } else {
    writeCookie('what', whatSelect.value);
  }

  var readLocation = readCookie('location');
  if (readLocation !== null) {
    var parts = readLocation.split('|');
    map.setView(L.latLng(parts[0], parts[1]), parts[2]);
  }

});