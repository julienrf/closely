require.config({
  baseUrl: '/assets',
  paths: {
    'leaflet': 'leaflet-0.7.3/leaflet',
    'qajax': 'qajax.min'
  }
});

require(['leaflet', 'routes', 'qajax', 'el', 'option'], function (L, routes, qajax, el, option) {

  var ajax = function (endpoint, opts) {
    opts = opts || {};
    opts.url = endpoint.url;
    opts.method = endpoint.method;
    return qajax(opts)
      .then(qajax.filterSuccess)
      .then(qajax.toJSON);
  };

  var removeChildren = function (node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  };

  var persistedState =
    option.map(window.localStorage.getItem('state'), function (_) { return JSON.parse(_) });

  var state = {
    knownPois: [], // Coordinates of already known pois
    myLocation: null, // Marker showing my location
    selectedKey: option.map(persistedState, function (_) { return _.selectedKey }),
    selectedValue: option.map(persistedState, function (_) { return _.selectedValue }),
    locationAndZoom: option.map(persistedState, function (_) { return _.locationAndZoom }),
    tags: option.map(window.localStorage.getItem('tags'), function (_) { return JSON.parse(_) })
  };

  window.addEventListener('beforeunload', function () {
    window.localStorage.setItem('state', JSON.stringify({
      selectedKey: state.selectedKey,
      selectedValue: state.selectedValue,
      locationAndZoom: state.locationAndZoom
    }));
  });

  var tagKeySelect = document.getElementById('tag-key');
  var tagValueSelect = document.getElementById('tag-value');
  var whereInput = document.getElementById('where');
  var locateMeBtn = document.getElementById('locate-me');

  if (state.tags === null) {
    ajax(routes.closely.Closely.tags())
      .then(function (json) {
        state.tags = json;
        window.localStorage.setItem('tags', JSON.stringify(state.tags));
        removeChildren(tagKeySelect);
        Object.keys(state.tags).forEach(function (key) { tagKeySelect.appendChild(el('option', { value: key })(key)) }) // TODO Manipulate the dom efficiently
      });
  } else {
    removeChildren(tagKeySelect);
    Object.keys(state.tags).forEach(function (key) { tagKeySelect.appendChild(el('option', { value: key })(key)) }) // TODO Manipulate the dom efficiently
  }

  L.Icon.Default.imagePath = '/assets/leaflet-0.7.3/images/'; // See https://github.com/Leaflet/Leaflet/issues/766

  var map = L.map(document.getElementById('map'), { minZoom: 15, zoomControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  map.addControl(L.control.zoom({ position: 'bottomright' }));

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

  tagKeySelect
    .addEventListener('change', function () {
      state.selectedKey = tagKeySelect.value;
      removeChildren(tagValueSelect);
      state.tags[tagKeySelect.value].forEach(function (v) { tagValueSelect.appendChild(el('option', { value: v })(v)) });
    });

  tagValueSelect
    .addEventListener('change', function () {
      state.selectedKey = tagValueSelect.value;
      state.knownPois = [];
      // TODO Remove pois and trigger search
    });

  whereInput.form
    .addEventListener('submit', function (e) {
      e.preventDefault();
      ajax(routes.closely.Closely.geocode(whereInput.value))
        .then(function (point) {
          map.setView([point.lat, point.lon], 17);
        }, function () {
          alert('Unable to find the given location')
        });
    });

  map.on('moveend', function () {
    state.locationAndZoom = {
      lat: map.getCenter().lat,
      lng: map.getCenter().lng,
      zoom: map.getZoom()
    };
    var bounds = map.getBounds();
    // TODO Use a cache to read cookie
    ajax(routes.closely.Closely.search(state.selectedKey, state.selectedValue, {
      north: bounds._northEast.lat,
      east: bounds._northEast.lng,
      south: bounds._southWest.lat,
      west: bounds._southWest.lng
    }))
      .then(function (json) {
        json.elements
          .filter(function (e) { return e.type === 'node' && state.knownPois.indexOf(e.id) === -1 })
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

  if (state.selectedKey !== null) {
    tagKeySelect.value = state.selectedKey;
  }
  if (state.selectedValue !== null) {
    tagValueSelect.value = state.selectedValue;
  }

  if (state.locationAndZoom !== null) {
    map.setView(L.latLng(state.locationAndZoom.lat, state.locationAndZoom.lng), state.locationAndZoom.zoom);
  }

});