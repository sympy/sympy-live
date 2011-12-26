function transition_about(){
    if (document.getElementById('about').style.height == "175px") {
	document.getElementById('about').style.height = "35px";
	document.getElementById('about_arrow_clicked').id='about_arrow';			}
    else {
	document.getElementById('about').style.height = "175px";
	document.getElementById('about_arrow').id='about_arrow_clicked';
    }
}
function transition_example(){
    if (document.getElementById('example').style.height == "175px") {
	document.getElementById('example').style.height = "35px";
	document.getElementById('example_arrow_clicked').id='example_arrow';			}
    else {
	document.getElementById('example').style.height = "175px";
	document.getElementById('example_arrow').id='example_arrow_clicked';
    }
}
function transition_other_shells(){
    if (document.getElementById('other_shells').style.height == "95px") {
	document.getElementById('other_shells').style.height = "35px";
	document.getElementById('other_shells_arrow_clicked').id='other_shells_arrow';
    }
    else {
	document.getElementById('other_shells').style.height = "95px";
	document.getElementById('other_shells_arrow').id='other_shells_arrow_clicked';
    }
}

function expand_userhistory(){
    if (document.getElementById('user_searches').style.height == "225px") {
	    <!-- document.getElementById('user_searches').style.overflow = "hidden"; -->
	    document.getElementById('user_searches').style.height = "35px";
	document.getElementById('user_searches_arrow_clicked').id='user_searches_arrow';
    } else {
	    <!--document.getElementById('user_searches').style.overflow = "auto"; -->
	    document.getElementById('user_searches').style.height = "225px";
	document.getElementById('user_searches_arrow').id='user_searches_arrow_clicked';
    }
}

function expand_history(){
    if (document.getElementById('recent_searches').style.height == "225px") {
	    <!-- document.getElementById('recent_searches').style.overflow = "hidden"; -->
	    document.getElementById('recent_searches').style.height = "35px";
	document.getElementById('recent_searches_arrow_clicked').id='recent_searches_arrow';
    } else {
	    <!-- document.getElementById('recent_searches').style.overflow = "auto";  -->
	    document.getElementById('recent_searches').style.height = "225px";
	document.getElementById('recent_searches_arrow').id='recent_searches_arrow_clicked';
    }
}

function clear_searches(){
    var confirm_delete = confirm("Are you sure you want to clear your search history?");
    if (confirm_delete==true)
    {
        Ext.Ajax.request({
            method: 'GET',
            url: (this.basePath || '') + '/delete',
            success: function(response) {
                var response = response.responseText;
                Ext.fly('saved_searches').update(response);
            },
        });
    }
}
