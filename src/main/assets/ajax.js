define(function () {
  return function (endpoint, success, error) {
    var xhr = new XMLHttpRequest();
    xhr.open(endpoint.method, endpoint.url);
    xhr.addEventListener('load', function () {
      if (xhr.status === 200) {
        var response = null;
        try {
          response = JSON.parse(xhr.responseText);
        } catch (ignored) { }
        if (response !== null) success(response);
        else error !== undefined && error();
      } else error !== undefined && error();
    });
    xhr.send();
  }
});