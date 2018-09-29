
var apiUrl = location.protocol + '//' + location.host + "/api/";

$('.sign-in-service').click(function() {
  updateService();
});
  
function updateService() {
  //get user input data
  var serviceID = $('.service-id input').val();
  var formcardID = $('.card-id input').val();

  //create json data
  var inputData = '{' + '"name" : "' + serviceID + '", ' + '"cardID" : "' + formcardID + '"}';

  //make ajax call
  $.ajax({
    type: 'POST',
    url: apiUrl + 'serviceData',
    data: inputData,
    dataType: 'json',
    contentType: 'application/json',
    beforeSend: function() {
      //display loading
      document.getElementById('loader').style.display = "block";
    },
    success: function(data) {
      //remove loader
      document.getElementById('loader').style.display = "none";
      //check data for error
      if (data.error) {
        alert(data.error);
        return;
      } 
      else {
        $('.upload-resource').click(function() {
          var resourceID = $('.resource-id').val();
          var accessCost = $('.access-cost').val();
          var contentHash = $('.content-hash').val();
          
          //create json data
          let inputData = '{' + '"cardID" : "' + formcardID + '", ' + 
                            '"resourceID" : "' + resourceID + '", ' + 
                            '"accessCost" : "' + accessCost + '", ' + 
                            '"contentHash" : "' + contentHash + '"}';
          console.log(inputData);
          $.ajax({
            type: 'POST',
            url: apiUrl + 'uploadResource',
            data: inputData,
            dataType: 'json',
            contentType: 'application/json',
            beforeSend: function() {
              //display loading
              document.getElementById('loader').style.display = "block";
            },
            success: function(data) {
              //remove loader
              document.getElementById('loader').style.display = "none";
              //check data for error
              if (data.error) {
                alert(data.error);
                return;
              } else {
                alert("Resource Uploaded!");
              }
            },
            error: function(jqXHR, textStatus, errorThrown) {
              console.log(errorThrown); console.log(textStatus); console.log(jqXHR);
              location.reload();
            }
          });        
        });
        
        $('.assessor-selector').html(function(){
          var str = '<option value="" disabled="" selected="">select</option>';
          for (let assessor of data['assessors'])
            str += '<option value=' + assessor.name + '> ' + assessor.name + '</option>';
          return str;
        });

        $('.add-assessor').click(function() {
          var assessorID = $('.assessor-selector').val();
          let inputData = '{' + '"cardID" : "' + formcardID + '", '
                          + '"assessorID" : "' + assessorID + '"}';
          $('.assessor-selector option[value="'+ assessorID + '"]').remove();
          if (!$('.assessor-selector').children('option').length)
            $(this).hide();
          console.log(inputData);
          $.ajax({
            type: 'POST',
            url: apiUrl + 'serviceAuthorizeAssessor',
            data: inputData,
            dataType: 'json',
            contentType: 'application/json',
            beforeSend: function() {
              document.getElementById('loader').style.display = "block";
            },
            success: function(data) {
              document.getElementById('loader').style.display = "none";
              if (data.error) {
                alert(data.error);
                return;
              } else {
                alert("Trustee Added!");
              }
            },
            error: function(jqXHR, textStatus, errorThrown) {
              console.log(errorThrown); console.log(textStatus); console.log(jqXHR);
              location.reload();
            }
          });        
        });
                
        $('.service-name').html(function() {
          var str = '<b><u>Service</u> name : </b>' + '<i>' + data.name + '</i>';
          return str;
        });

        // //update dashboard
        // $('.dashboards').html(function() {
        //   var str = '';
        //   str = str + '<h5>Total balance allocated to users: ' + data.balanceGiven + ' </h5>';
        //   return str;
        // });

        //remove login section
        document.getElementById('loginSection').style.display = "none";
        //display transaction section
        document.getElementById('transactionSection').style.display = "block";
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log(errorThrown); console.log(textStatus); console.log(jqXHR);
      location.reload();
    }
  });
}