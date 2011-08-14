/**
 * Repository module - holds functions for version management
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  sys = require('sys');

/**
 * Exports
 * Note that any hooks must be exposed here to be seen by Calipso
 */
exports = module.exports = {
  versionCreateForm: versionCreateForm,
  versionCreate: versionCreate,
  versionUpdateForm: versionUpdateForm,
  versionUpdate: versionUpdate,
  versionDelete: versionDelete
}

function repoVersionForm() {
  return {id:'repo-version-form',title:'Add a version ...',type:'form',method:'POST',action:'',tabs:false,
      fields:[
              {label:'Project or URL',name:'repoVersion[url]',type:'text',description:'Enter github repo/name, or a full URL to a zip file.'},
              {label:'Version',name:'repoVersion[version]',type:'text',description:'Enter the version (e.g. 0.2.3 or master for the latest version).'},
              {label:'Status',name:'repoVersion[status]',type:'select',options:["An Idea","Alpha","Beta","Production"],description:'Where is it in its lifecycle?'},
              {label:'Calipso Versions',name:'repoVersion[calipsoVersion]',type:'text',description:'What Calipso versions is it compatible with?'},
              {label:'Version Comments',name:'repoVersion[comments]',type:'textarea',description:'Describe anything particular about this version.'},
              {label:'',name:'repoVersion[key]',type:'hidden'}
             ],
      buttons:[
           {name:'submit',type:'submit',value:'Save'}
      ]};
}


/**
 * Helper to check if user is the author of an object
 */
function isAuthor(req,author) {
  return req.session && req.session.user && ((req.session.user.username === author) || req.session.user.isAdmin);
}


/**
 * Version
 */
function versionCreateForm(req, res, key, next) {

   // Create the form
  var form = repoVersionForm(); // Use exports as other modules may alter the form function
  form.action = '/repo/version/create';
  form.title = "Add a version ...";

  // Default values
  var values = {
    repoVersion: {
      key: key
    }
  }

  calipso.form.render(form,values,req,function(form) {
    next(null,form);
  });

};

function versionCreate(req, res, template, block, next) {

 // Render the item via the template provided above
  calipso.form.process(req,function(form) {

    if(form) {

      var Repo = calipso.lib.mongoose.model('Repo');
      var RepoVersion = calipso.lib.mongoose.model('RepoVersion');

      // Get the key
      var key = form.repoVersion.key;
      delete form.repoVersion.key;

      var rv = new RepoVersion(form.repoVersion);

      Repo.findOne({key:key},function (err, r) {
        if(err || !r) {
          req.flash('error',req.t('Wasnt able to find the {type} named {name}.',{type:type,name:name}));
          if(res.statusCode != 302) {
              res.redirect('/repo');
          }
        } else {


          // Only authors can create a new version
          if(!isAuthor(req,r.author)) {
            req.flash('error', req.t('You need to be the author or an administrator to perform that action.'));
            res.statusCode = 401;
            res.redirect("/repo/show/" + key);
            next();
            return;
          }

          r.versions.push(rv);
          calipso.e.pre_emit('REPO_UPDATE',r,function(r) {
            r.save(function(err) {
              if(err) {
                calipso.debug(err);
                req.flash('error',req.t('Could not update item into repository because {msg}.',{msg:err.message}));
                if(res.statusCode != 302) {
                    res.redirect('/repo/show/'+ key);
                }
                next();
              } else {
                req.flash('info',req.t('Updates saved ...'));
                calipso.e.post_emit('REPO_UPDATE',r,function(r) {
                  res.redirect('/repo/show/' + key);
                  next();
                });

              }
            });
         });

        }
        next();
      });

    } else {

      res.redirect('/repo/' + r.type + '/create');

    }

  });


};


function versionUpdateForm(req, res, key, next) {

  next(null,"HELLO");

};

function versionUpdate(req, res, key, next) {

  next(null,"HELLO");

};

function versionDelete(req, res, template, block, next) {


  // Render the item via the template provided above
  var type = req.moduleParams.type || 'module';
  var name = req.moduleParams.name || 'unknown';
  var id = req.moduleParams.id || 'unknown';
  var key = type + "/" + name;

  var Repo = calipso.lib.mongoose.model('Repo');

  Repo.findOne({key:key},function (err, r) {

    // Only authors can create a new version
    if(!isAuthor(req,r.author)) {
      req.flash('error', req.t('You need to be the author or an administrator to perform that action.'));
      res.statusCode = 401;
      res.redirect("/repo/show/" + key);
      next();
      return;
    }

    r.versions.id(id).remove();

    r.save(function(err) {
      if(err) {
        calipso.debug(err);
        req.flash('error',req.t('Could not delete version because {msg}.',{msg:err.message}));

      }
      if(res.statusCode != 302) {
          res.redirect('/repo/show/'+ r.key);
      }
      next();
    });
  });

};
