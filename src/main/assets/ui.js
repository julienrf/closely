define(['el', 'option'], function (el, option) {

  var removeChildren = function (node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  };

  return function (state) {
    // TODO Use inline CSS instead of ids
    var map = el('div', {id: 'map'})();
    var keySelect = el('select', {id: 'tag-key', title: 'Tag key'})();
    var valueSelect = el('select', {id: 'tag-value', title: 'Tag value'})();
    var whereInput = el('input', {type: 'text', id: 'where', placeholder: 'Search for a location'})();
    var locateMeBtn = el('button', {title: 'Use my current location', id: 'locate-me'})('\u2316');
    var toggleBtn = el('button')(state.controlsAreVisible ? '\u25C0' : '\u25B6');
    var controlsAttrs = { id: 'controls' };
    if (!state.controlsAreVisible) { controlsAttrs['style'] = 'display: none;'; }
    var controls =
      el('div', controlsAttrs)(
        el('div', {id: 'location'})(
          el('form', {id: 'where-wrapper'})(whereInput),
          el('span', {id: 'locate-me-wrapper'})(locateMeBtn)
        ),
        el('div', {id: 'tag'})(keySelect, valueSelect)
      );
    var root =
      el('div', { style: 'height: 100%' })(
        map,
        el('div', { id: 'controls-and-handle' })(
          controls,
          el('div', {id: 'handle'})(toggleBtn)
        )
      );

    var updateSelect = function (node, options, maybeSelected) {
      removeChildren(node);
      options.forEach(function (opt) {
        var attrs = { value: opt };
        if (maybeSelected === opt) {
          attrs.selected = 'selected';
        }
        node.appendChild(el('option', attrs)(opt));
      });

    };

    return {
      root: root,
      map: map,
      keySelect: keySelect,
      valueSelect: valueSelect,
      whereInput: whereInput,
      locateMeBtn: locateMeBtn,
      toggleBtn: toggleBtn,
      // TODO Manipulate the dom efficiently
      update: {
        keySelect: function (state) {
          updateSelect(keySelect, Object.keys(state.tags), state.selectedKey);
        },
        valueSelect: function (state) {
          updateSelect(valueSelect, state.tags[option.getOrElse(state.selectedKey, function () { return Object.keys(state.tags)[0] })], state.selectedValue);
        },
        controls: function (state) {
          if (state.controlsAreVisible) {
            controls.style.display = 'table-cell';
            toggleBtn.textContent = '\u25C0';
          } else {
            controls.style.display = 'none';
            toggleBtn.textContent = '\u25B6';
          }
        }
      }
    }
  }
});