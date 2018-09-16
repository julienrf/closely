require.config({
  baseUrl: '/assets',
  paths: {
    'leaflet': 'leaflet-1.3.4/leaflet'
  }
});

require(['leaflet', 'routes', 'option', 'ui', 'ajax', 'el'], function (L, routes, option, Ui, ajax, el) {

  var persistedState =
    option.map(window.localStorage.getItem('state'), function (_) { return JSON.parse(_) });

  var things = {
    "drinking_water": {
      "key": "amenity",
      "value": "drinking_water",
      "label": "Drinking water"
    },
    "recycling": {
      "key": "amenity",
      "value": "recycling",
      "label": "Recycling"
    },
    "waste_basket": {
      "key": "amenity",
      "value": "waste_basket",
      "label": "Waste basket"
    },
    "toilets": {
      "key": "amenity",
      "value": "toilets",
      "label": "Toilets"
    },
    "bench": {
      "key": "amenity",
      "value": "bench",
      "label": "Bench"
    },
    "picnic_table": {
      "key": "leisure",
      "value": "picnic_table",
      "label": "Picnic table"
    },
    "picnic_site": {
      "key": "tourism",
      "value": "picnic_site",
      "label": "Picnic site"
    },
    "pharmacy": {
      "key": "amenity",
      "value": "pharmacy",
      "label": "Pharmacy"
    },
    "police": {
      "key": "amenity",
      "value": "police",
      "label": "Police"
    }
  };

  var state = {
    knownPois: [], // Coordinates of already known pois
    poisLayer: L.layerGroup(), // Layer of pois
    myLocation: null, // Marker showing my location
    selectedThing: option.getOrElse(option.map(persistedState, function (_) { return _.selectedThing }), function () { 'picnic_site' }),
    locationAndZoom: option.map(persistedState, function (_) { return _.locationAndZoom }),
    controlsAreVisible: option.fold(persistedState, function () { return true }, function (_) { return _.controlsAreVisible })
  };

  window.addEventListener('beforeunload', function () {
    window.localStorage.setItem('state', JSON.stringify({
      selectedThing: state.selectedThing,
      locationAndZoom: state.locationAndZoom,
      controlsAreVisible: state.controlsAreVisible
    }));
  });

  var ui = Ui(state);

  ui.update.thingSelect(state, things);

  ui.thingSelect
    .addEventListener('change', function () {
      state.selectedThing = ui.thingSelect.value;
      state.knownPois = [];
      state.poisLayer.clearLayers();
      triggerSearch();
    });

  L.Icon.Default.imagePath = '/assets/leaflet-1.3.4/images/'; // See https://github.com/Leaflet/Leaflet/issues/766

  var map = L.map(ui.map, { minZoom: 14, zoomControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  map.addControl(L.control.zoom({ position: 'bottomright' }));
  state.poisLayer.addTo(map);

  map.on('locationfound', function (e) {
    map.setView(e.latlng, 17);
    if (state.myLocation === null) {
      state.myLocation = L.circleMarker(e.latlng);
      state.myLocation.addTo(map);
    } else {
      state.myLocation.setLatLng(e.latlng);
    }
  });

  map.on('locationerror', function (e) {
    alert('Unable to locate the device. ' + e.message);
    console.error(e);
  });

  ui.locateMeBtn
    .addEventListener('click', function () {
      map.locate({ timeout: 30 * 1000 });
    });

  ui.whereInput.form
    .addEventListener('submit', function (e) {
      e.preventDefault();
      ajax(
        routes.closely.Closely.geocode(ui.whereInput.value),
        function (point) {
          map.setView([point.lat, point.lon], 17);
        }, function () {
          alert('Unable to find the given location')
        }
      );
    });

  var triggerSearch = function () {
    state.locationAndZoom = {
      lat: map.getCenter().lat,
      lng: map.getCenter().lng,
      zoom: map.getZoom()
    };
    var bounds = map.getBounds();
    ajax(
      routes.closely.Closely.search(things[state.selectedThing].key, things[state.selectedThing].value, {
        north: bounds._northEast.lat,
        east: bounds._northEast.lng,
        south: bounds._southWest.lat,
        west: bounds._southWest.lng
      }), function (json) {
        json.elements
          .filter(function (e) { return e.type === 'node' && state.knownPois.indexOf(e.id) === -1 })
          .forEach(function (e) {
            state.knownPois.push(e.id);
            state.poisLayer.addLayer(
              L.marker([e.lat, e.lon])
                .bindPopup(el('ul')(
                  Object.keys(e.tags || {}).map(function (tag) {
                    return el('li')(el('strong')(tag), ': ' + e.tags[tag])
                  })
                ))
            );
          });
      }
    );
  };

  map.on('moveend', function () {
    triggerSearch();
  });

  if (state.locationAndZoom !== null) {
    map.setView(L.latLng(state.locationAndZoom.lat, state.locationAndZoom.lng), state.locationAndZoom.zoom);
  }

  ui.toggleBtn.addEventListener('click', function () {
    state.controlsAreVisible = !state.controlsAreVisible;
    ui.update.controls(state);
  });

  document.body.appendChild(ui.root);
  map.invalidateSize();

});