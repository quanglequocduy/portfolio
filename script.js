function addRecommendation() {
  let newRecommendation = document.getElementById('new_recommendation');

  if (newRecommendation.value !== null && newRecommendation.value.trim() !== '') {
    console.log(`New recommendation added`);

    showPopup(true);

    let element = document.createElement('div');
    element.setAttribute('class', 'recommendation');
    element.innerHTML = "\<span\>&#8220;\</span\>" + newRecommendation.value + "\<span\>&#8221;\</span\>";
    document.getElementById("all_recommendations").appendChild(element); 

    newRecommendation.value = "";
  }
}

function showPopup(isShow) {
  if (isShow) {
    document.getElementById('popup').style.visibility = 'visible';
  } else {
    document.getElementById('popup').style.visibility = 'hidden';
  }
}
