
var apiUrl = location.protocol + '//' + location.host + "/api/";

//check user input and call server
$('.sign-in-issuer').click(function() {
  updateIssuer();
});
  
function updateIssuer() {
  //get user input data
  var issuerID = $('.issuer-id input').val();
  var formcardID = $('.card-id input').val();
  
  //create json data
  var inputData = '{' + '"issuerID" : "' + issuerID + '", ' + '"cardID" : "' + formcardID + '"}';
  //make ajax call
  $.ajax({
    type: 'POST',
    url: apiUrl + 'issuerData',
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
        console.log(data);
        let claimReqHTML = '<div><a href="#" class="claim-id" style="text-decoration : none"><b>$</b></a>' +
                            '<button class="far fa-thumbs-up btn btn-default decide approve" style="margin-left: 25px;"></button>' +
                            '<button class="far fa-thumbs-down btn btn-default decide deny" style="margin-left: 5px;"></button></div><br/>';
        let proofNameHTML = '<h5 style="width:50%; word-wrap: break-word">$</h5>';
        let proofHashHTML = '<h5 style="width:50%; word-wrap: break-word"><a href="$">$</a></h5>';
        let proofKeyHTML = '<div class="row">' +
                                '<label for="key" style="margin-left: 20px; margin-right: 33px;">Key:</label>' +
                                '<p class="col-md-9" style="word-wrap: break-word"><u>$</u></p>' +
                           '</div>';
        let proofValHTML = '<div class="row" style="margin-bottom: 10px;">' +
                                '<label for="value" style="margin-left: 20px; margin-right: 20px;">Value:</label>' +
                                '<p class="col-md-9" style="word-wrap: break-word"><i>$</i></p>' +
                           '</div> ';
        var saved = {};
        $('.save-claim').click(function(){
          let name = $('.claim-name').val();
          let type = $('.claim-type').val();
          let expire = $( "#datepicker").val();
          
          if  (name.length && expire.length && 
              (type === 'USER' || type === 'DEVICE' || type === 'CONTEXT'))
               saved[claimID] = {
                  'name' : name,
                  'type' : type,
                  'expire': expire,
                  'keys' : ''
               };
          else
              alert("Must pick type and name must not be blank.");
          console.log(saved);
        }); 
        $('.claimRequests').html(function() {
          let str = '';
          for (let req of data.requests)
            str += claimReqHTML.replace('$', req.claimID);
          return str;
        });
        $('.claim-id').click(function(e){
          e.preventDefault();
          claimID = $(this).text();
          
          $( "#datepicker").datepicker();
          $('.modal-content div:not(:first)').remove();;
          if (!saved[claimID]) {
            $('.claim-name').val('');
            $('.claim-type').val('');
            $('#datepicker').val('');
          } 
          else {
            $('.claim-name').val(saved[claimID].name);
            $('.claim-type').val(saved[claimID].type);
            $('#datepicker').val(saved[claimID].expire);
          }
          for (let claim of data.requests) {
            if (claim.claimID === claimID)
                proofs = claim.proof;
          }
          for (let proof of proofs) {
            let body = '<div class="modal-body">';
            let header = '<div class="modal-header">' + proofNameHTML.replace('$', proof.proofName);
            if (proof.proofHash.startsWith("http"))
              header += proofHashHTML.replace('$', proof.proofHash).replace('$', proof.proofHash);
            else
              header += proofHashHTML.replace('$', 'http://ipfs.io/ipfs/' + proof.proofHash).replace('$', proof.proofHash);

            $('.modal-content').append(header + '</div>');
            
            for (let attr of proof.data) {
                body += proofKeyHTML.replace('$', attr.key);
                body += proofValHTML.replace('$', attr.val);
            }
            $('.modal-content').append(body + '</div>');
          }    
          $('#myModal').modal('show');
        });
        $('.decide').click(function(){
          let claimID = $(this).siblings('.claim-id').text();
          let inputData = { "cardID" : formcardID,
                         "requestID" : claimID
                          };
          if (!saved[claimID] && this.className.endsWith('approve'))
            alert('Please click on the request you are deciding on and fill in details!');
          
          else if (window.confirm("Are you sure?")) { 
            if (this.className.endsWith('approve'))
                inputData['status'] = 'APPROVED';
            else if (this.className.endsWith('deny'))
                inputData['status'] = 'DENIED';

            if (saved[claimID]) {
              inputData["expire"] = saved[claimID].expire;
              inputData["type"] = saved[claimID].type;
              inputData["name"] = saved[claimID].name;
              inputData["keys"] = saved[claimID].keys;
            } else {
              inputData["expire"] = '';
              inputData["type"] = '';
              inputData["name"] = '';
              inputData["keys"] = '';
            }
            $.ajax({
                type: 'POST',
                url: apiUrl + 'issueClaim',
                data: JSON.stringify(inputData),
                dataType: 'json',
                contentType: 'application/json',
                beforeSend: function() {
                  //display loading
                  document.getElementById('loader').style.display = "block";
                },
                success: function(res) {
                  //remove loader
                  document.getElementById('loader').style.display = "none";
                  //check data for error
                  if (res.error) {
                    alert(res.error);
                    return;
                  } else {
                    if (inputData['status'] === 'APPROVED')
                      alert("Claim Issued!");
                    else
                      alert("Claim Request Rejected!");
                  }
                },
                error: function(jqXHR, textStatus, errorThrown) {
                  console.log(errorThrown); console.log(textStatus); console.log(jqXHR);
                  location.reload();
                }
            });        
            $(this).closest('div').remove();
          }
        });
        $('.assessor-selector').html(function(){
          var str = '<option value="" disabled="" selected="">select</option>';
          for (let assessor of data.assessors)
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
            url: apiUrl + 'issuerAuthorizeAssessor',
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
        //update heading
        $('.issuer-name').html(function() {
          var str = '<b><u>Issuer</u> name : </b>' + '<i>' + data.name + '</i>';
          return str;
        });
        //remove login section
        document.getElementById('loginSection').style.display = "none";
        //display transaction section
        document.getElementById('transactionSection').style.display = "block";
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      //reload on error
      alert("Error: Try again")
      console.log(errorThrown);
      console.log(textStatus);
      console.log(jqXHR);
      location.reload();
    }
  });
}
