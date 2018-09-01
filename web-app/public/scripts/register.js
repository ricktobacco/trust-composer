
var apiUrl = location.protocol + '//' + location.host + "/api/";

console.log("at register.js");

//check user input and call server to create dataset
$('.register-participant').click(function() {
  //get user input data
  var formName = $('#name').val();
  var formType = $('#type').val();
  var formcardID = $('#card-id').val();

  //create json data
  var inputData = '{' + '"name" : "' + formName + '", ' + '"type" : "' + formType + '", ' + '"cardID" : "' + formcardID + '"}';
  console.log(inputData)

  //make ajax call to add the dataset
  $.ajax({
    type: 'POST',
    url: apiUrl + 'registerParticipant',
    data: inputData,
    dataType: 'json',
    contentType: 'application/json',
    beforeSend: function() {
      //display loading
      document.getElementById('registration').style.display = "none";
      document.getElementById('loader').style.display = "block";
    },
    success: function(data) {
      //remove loader
      document.getElementById('loader').style.display = "none";
      //check data for error
      if (data.error) {
        document.getElementById('registration').style.display = "block";
        alert(data.error);
        return;
      } else {
        //notify successful registration
        document.getElementById('successful-registration').style.display = "block";
        document.getElementById('registration-info').style.display = "none";
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log(errorThrown); console.log(textStatus); console.log(jqXHR);
    }
  });
});
