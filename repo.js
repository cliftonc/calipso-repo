/**
 * Repository module
 */
var rootpath = process.cwd() + '/',
  path = require('path'),
  calipso = require(path.join(rootpath, 'lib/calipso')),
  sys = require('sys'),
  Query = require('mongoose').Query,
  version = require('./repo.version');

/**
 * Exports
 * Note that any hooks must be exposed here to be seen by Calipso
 */
exports = module.exports = {
  init: init,
  route: route,
  install: install
};

/**
 * Routing function, this is executed by Calipso in response to a http request (if enabled)
 */
function route(req, res, module, app, next) {

  // Menu items
  res.menu.primary.addMenuItem(req, {name:'Repository',path:'repo',url:'/repo',description:'Module and theme repository ...',permit:"admin:core:configuration"});

  // Router
  module.router.route(req, res, next);

};


/**
 * Initialisation function, this is executed by calipso as the application boots up
 */
function init(module, app, next) {

    // Register events for the REPO Module
  calipso.e.addEvent('REPO_CREATE');
  calipso.e.addEvent('REPO_UPDATE');
  calipso.e.addEvent('REPO_DELETE');

  calipso.e.addEvent('REPO_VERSION'); // General purpose
  calipso.e.addEvent('REPO_COMMENT'); // General purpose

  calipso.lib.step(

  function defineRoutes() {

    // Home Page
    module.router.addRoute('GET /repo', repoHome, {template: 'home', block: 'content.repo'}, this.parallel());
    module.router.addRoute('GET /repo/:type', repoList, {template: 'list', block: 'content.repo'}, this.parallel());
    module.router.addRoute('GET /repo/show/:type/:name', repoShow, {template:'show', block: 'content.repo.show'}, this.parallel());

    // Logged In User Forms
    module.router.addRoute('GET /repo/create/:type', repoCreateForm, {user:true, block: 'content.repo.create'}, this.parallel());
    module.router.addRoute('POST /repo/create', repoCreate, {user:true}, this.parallel());

    // Versions
    module.router.addRoute('POST /repo/version/create', version.versionCreate, {user:true}, this.parallel());
    module.router.addRoute('GET /repo/version/delete/:type/:name/:id', version.versionDelete, {user:true}, this.parallel());

    // Admin forms
    module.router.addRoute('GET /repo/edit/:type/:name', repoUpdateForm, {user:true, block: 'content.repo.edit'}, this.parallel());
    module.router.addRoute('POST /repo/update', repoUpdate, {user:true}, this.parallel());
    module.router.addRoute('GET /repo/delete/:id', repoDelete, {user:true}, this.parallel());

    // API
    module.router.addRoute('GET /repo/api/find/:type/:query?', repoFindJson, {}, this.parallel());
    module.router.addRoute('GET /repo/api/get/:type/:name/:version?', repoGetJson, {}, this.parallel());

  }, function done() {

    // Repository schemas
    // Versions
    var RepoVersion = new calipso.lib.mongoose.Schema({
       version:{type: String, required: true, "default": '0.0.1'},
       url:{type: String, required: true, "default": ''},
       calipsoVersion:{type: String, required: true, "default": '0.2.x'},
       status:{type: String, required: true, "default": 'alpha'},
       comments:{type: String, required: false, "default": ''},
       created: { type: Date, "default": Date.now },
       updated: { type: Date, "default": Date.now }
    });
    calipso.db.model('RepoVersion', RepoVersion);

    // Comments
    var RepoComment = new calipso.lib.mongoose.Schema({
       user:{type: String, required: true},
       comment:{type: String, required: true},
       rating:{type: Number},
       created: { type: Date, "default": Date.now },
       updated: { type: Date, "default": Date.now }
    });
    calipso.db.model('RepoComment', RepoComment);

    // Repository
    var Repo = new calipso.lib.mongoose.Schema({
      key:{type: String, required: true, index: { unique: true }},
      name:{type: String, required: true, index: true, validate: /^\w*$/},
      type:{type: String, required: true, index: true, "default": 'module'},
      description:{type: String, "default": ''},
      author:{type: String, "default": ''},
      versions:[RepoVersion],
      comments:[RepoComment],
      images:[String],
      created: { type: Date, "default": Date.now },
      updated: { type: Date, "default": Date.now }
    });
    calipso.db.model('Repo', Repo);

    next();

  });

};

/**
 * Helper to check if user is the author of an object
 */
function isAuthor(req,author) {
  return req.session && req.session.user && ((req.session.user.username === author) || req.session.user.isAdmin);
}

/**
 * Helper functions to manage the forms
 */
function repoForm() {
  return {id:'repo-form',title:'Add your module or theme ...',type:'form',method:'POST',action:'',tabs:false,
      fields:[
              {label:'Name',name:'repo[name]',type:'text',description:'Enter the name of your module or theme (no spaces or invalid chars).'},
              {label:'Type',name:'repo[type]',type:'select',options:[{label:"Module",value:"module"},{label:"Theme",value:"theme"},{label:"Profile",value:"profile"}],description:'What is it?'},
              {label:'Description',name:'repo[description]',type:'textarea',description:'Provide a description so others understand what youre trying to do.'},
              {label:'Author',name:'repo[author]',type:'text',description:'Enter your name.',readonly:false}
             ],
      buttons:[
           {name:'submit',type:'submit',value:'Submit'}
      ]};
}

function repoCommentForm() {
   return {id:'repo-comment-form',title:'Add a comment ...',type:'form',method:'POST',action:'',tabs:false,
      fields:[
              {label:'Comment',name:'repoComment[comment]',type:'textarea',description:'What do you have to say?'},
              {label:'Rating',name:'repoComment[rating]',type:'select',options:["1","2","3","4","5"],description:'Rate what you think of the module, theme or profile.'}
             ],
      buttons:[
           {name:'submit',type:'submit',value:'Submit'}
      ]};
}

/**
 * Simple home page function
 */
function repoHome(req, res, template, block, next) {

  var Repo = calipso.db.model('Repo');

  Repo.find({})
    .sort('name')
    .limit(100)
    .find(function(err,all) {
        Repo.find({type:'module'})
          .sort('-updated type name')
          .limit(20)
          .find(function(err,mods) {
              Repo.find({type:'theme'})
                .sort('-updated type name')
                .limit(20)
                .find(function(err,themes) {
                    Repo.find({type:'profile'})
                    .sort('-updated type name')
                    .limit(20)
                    .find(function(err,profiles) {
                        calipso.theme.renderItem(req,res,template,block,{
                           all:all,
                           thms:themes,
                           mods:mods, // modules is protected!
                           profiles:profiles
                       },next);
                  });
              });
        });
    });

};

/**
 * List all items from the repostiory
 */
function repoList(req, res, template, block, next) {

  var Repo = calipso.db.model('Repo');
  var type = req.moduleParams.type || "module";

  // TODO - Add pager

  Repo.find({type:type})
    .sort('name')
    .limit(100)
    .find(function(err,all) {
        calipso.theme.renderItem(req,res,template,block,{
           type:type,
           all:all
       },next);

  });

};

/**
 * API : Get a specific item from the repo
 */
function repoGetJson(req, res, template, block, next) {

  var Repo = calipso.db.model('Repo');
  var type = req.moduleParams.type || "module";
  var name = req.moduleParams.name || "";
  var version = req.moduleParams.version || "master";

  // TODO - Add pager
  Repo.find({type:type, name:name})
    .sort('name')
    .limit(10)
    .find(function(err,all) {
      var op = all.map(function(a) {
        return {name:a.name,
                description:a.description,
                versions:a.versions.map(function(b){
                    return {version:b.version,url:b.url}
                })
        };
      });
      res.end(JSON.stringify(op),'UTF-8');
    });

};

/**
 * API : Search the repository
 */
function repoFindJson(req, res, template, block, next) {

  var Repo = calipso.db.model('Repo');
  var query = req.moduleParams.query || "*";
  var type = req.moduleParams.type || "module";

  // Deal with wildcards
  var qryRegex = new RegExp(query,"ig");

  Repo.find({type:type, $or: [{name: qryRegex}, {description: qryRegex}] })
    .sort('name')
    .limit(10)
    .find(function(err,all) {
      var op = all.map(function(a) {
          return {name:a.name,
                  description:a.description,
                  author:a.author,
                  versions:a.versions.map(function(b){
                      return {version:b.version,url:b.url}
                  })

          };
      });
      res.end(JSON.stringify(op),'UTF-8');
    });

};

/**
 * Show
 */
function repoShow(req, res, template, block, next) {

  // Render the item via the template provided above
  var type = req.moduleParams.type || 'module';
  var name = req.moduleParams.name || 'unknown';
  var key = type + "/" + name;

  var Repo =calipso.db.model('Repo');

  Repo.findOne({key:key},function (err, r) {

    if(err || !r) {
      req.flash('error',req.t('Wasnt able to find the {type} named {name}.',{type:type,name:name}));
      if(res.statusCode != 302) {
          res.redirect('/repo');
      }
    } else {

      if(isAuthor(req,r.author)) {

        res.menu.userToolbar.addMenuItem(req, {name:'Edit',weight:1,path:'edit',url:'/repo/edit/' + type + '/' + name,description:'Edit ...',permit:'admin:core:configuration'});
        res.menu.userToolbar.addMenuItem(req, {name:'Delete',cls:'delete',weight:2,path:'delete',url:'/repo/delete/' + r._id,description:'Delete ...',permit:'admin:core:configuration'});

      }

      // Get our embedded stuff
      calipso.lib.step(
        function versionForm() {
          if(isAuthor(req,r.author)) {
            version.versionCreateForm(req, res, key, this.parallel());
          } else {
            this.parallel()();
          }
        },
        function done(err,versionForm) {
          calipso.theme.renderItem(req,res,template,block,{item:r,versionForm:versionForm},next);
        }
      )

    }
  });

};

/**
 * Create Form
 */
function repoCreateForm(req, res, template, block, next) {

  var type = req.moduleParams.type || 'module';

    // Create the form
  var form = repoForm(); // Use exports as other modules may alter the form function
  form.action = '/repo/create';
  form.title = "Submit a new " + type + " ...";

  // Default values
  var values = {
    repo: {
      type:type,
      author:req.helpers.user.username
    }
  }

  calipso.form.render(form,values,req,function(form) {
    calipso.theme.renderItem(req,res,form,block,{},next);
  });

};

/**
 * Create
 */
function repoCreate(req, res, template, block, next) {

  // Render the item via the template provided above
  calipso.form.process(req,function(form) {

    if(form) {

      var Repo = calipso.db.model('Repo');
      var r = new Repo(form.repo);
      r.key = r.type + "/" + r.name;

      calipso.e.pre_emit('REPO_CREATE',r,function(r) {

        r.save(function(err) {
          if(err) {
            calipso.debug(err);
            req.flash('error',req.t('Could not save new item into repository because {msg}.',{msg:err.message}));
            if(res.statusCode != 302) {
                res.redirect('/repo/create/'+ r.type);
            }
            next();
          } else {
            req.flash('info',req.t('New repository item saved ...'));
            calipso.e.post_emit('REPO_CREATE',r,function(r) {
              res.redirect('/repo/show/' + r.type + '/' + r.name);
              next();
            });

          }

        });

      });
    } else {
      res.redirect('/repo/' + r.type + '/create');
    }

  });

};

/**
 * Edit Form
 */
function repoUpdateForm(req, res, template, block, next) {

  var type = req.moduleParams.type || 'module';
  var name = req.moduleParams.name || 'unknown';
  var key = type + "/" + name;

    // Create the form
  var form = repoForm(); // Use exports as other modules may alter the form function
  form.action = '/repo/update';
  form.title = "Update " + type + " " + name + " ...";
  form.fields.push({label:'',name:'repo[key]',type:'hidden'});

  var Repo = calipso.db.model('Repo');

  console.dir(req.flash);

  Repo.findOne({key:key},function (err, r) {
    if(err || !r) {
      req.flash('error',req.t('Wasnt able to find the {type} named {name}.',{type:type,name:name}));
      if(res.statusCode != 302) {
          res.redirect('/repo');
      }
    } else {

      // Only authors can update
      if(!isAuthor(req,r.author)) {
        req.flash('error', req.t('You need to be the author or an administrator to perform that action.'));
        res.statusCode = 401;
        res.redirect("/repo/show/" + key);
        next();
        return;
      }

      var values = {
        repo: r
      }

      calipso.form.render(form,values,req,function(form) {
        calipso.theme.renderItem(req,res,form,block,{},next);
      });
    }
  });

};

/**
 * Update
 */
function repoUpdate(req, res, template, block, next) {

    // Render the item via the template provided above
    // Render the item via the template provided above
  calipso.form.process(req,function(form) {

    if(form) {

      var key = form.repo.key;
      var origType = form.repo.key.split(":")[0];
      var origName = form.repo.key.split(":")[1];

      var Repo =calipso.db.model('Repo');

      Repo.findOne({key:key},function (err, r) {

        if(err || !r) {

          req.flash('error',req.t('Wasnt able to find the {type} named {name}.',{type:origType,name:origName}));
          if(res.statusCode != 302) {
              res.redirect('/repo');
          }

        } else {

          // Only authors can update
          if(!isAuthor(req,r.author)) {
            req.flash('error', req.t('You need to be the author or an administrator to perform that action.'));
            res.statusCode = 401;
            res.redirect("/repo/show/" + key);
            next();
            return;
          }

          // Copy over
          calipso.form.mapFields(form.repo,r);
          r.key = r.type + "/" + r.name;

          calipso.e.pre_emit('REPO_UPDATE',r,function(r) {
            r.save(function(err) {
              if(err) {
                calipso.debug(err);
                req.flash('error',req.t('Could not update item into repository because {msg}.',{msg:err.message}));
                if(res.statusCode != 302) {
                    res.redirect('/repo/edit/'+ key);
                }
                next();
              } else {
                req.flash('info',req.t('Updates saved ...'));
                calipso.e.post_emit('REPO_UPDATE',r,function(r) {
                  res.redirect('/repo/show/' + r.type + '/' + r.name);
                  next();
                });

              }

            });

          });
        }
      });

    } else {
      res.redirect('/repo');
      next();
    }
  });

};

/**
 * Delete
 */
function repoDelete(req, res, template, block, next) {

    // Render the item via the template provided above
  var Repo = calipso.db.model('Repo');
  var id = req.moduleParams.id;

  Repo.findById(id, function(err, r) {

    // Raise CONTENT_CREATE event
    calipso.e.pre_emit('REPO_DELETE',r);

    // Only authors can delete
    if(!isAuthor(req,r.author)) {
      req.flash('error', req.t('You need to be the author or an administrator to perform that action.'));
      res.statusCode = 401;
      res.redirect("/repo/show/" + r.type + "/" + r.name);
      next();
      return;
    }

    Repo.remove({_id:id}, function(err) {
      if(err) {
        req.flash('info',req.t('Unable to delete the item because {msg}',{msg:err.message}));
        res.redirect("/repo/show/" + r.type + "/" + r.name);
      } else {
        calipso.e.post_emit('REPO_DELETE',r);
        req.flash('info',req.t('The ' + r.type + ' has now been deleted.'));
        res.redirect("/repo");
      }
      next();
    });

  });

};


/**
 * installation hook
 */
function install() {
  calipso.log("Template module installed");
}
