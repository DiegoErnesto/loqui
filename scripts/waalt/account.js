'use strict';

var Account = function (core) {
  
  // Holds only account data and no functions
  this.core = core;
  this.core.sendQ = this.core.sendQ || [];
  this.connector = new App.connectors[Providers.data[this.core.provider].connector.type](this);
  this.chats = [];
  
  // Test account
  this.test = function () {
    this.connector.connect({
      connecting: function () {
        Lungo.Notification.show('globe', _('Connecting'));
      },
      authenticating: function () {
        Lungo.Notification.show('key', _('Authenticating'));
      },
      connected: function () {
        Lungo.Notification.show('download', _('Synchronizing'));
        var cb = function () {
          // Don't add an account if already set up
          if (Accounts.find(this.core.user, this.core.provider) < 0) {
            App.accounts.push(this);
            App.smartpush('accountsCores', this.core);
          }
          Lungo.Notification.hide();
          $('section.setup#' + this.core.provider + ' input').val('');
          $('section#success span#imported').text(this.core.roster.length || 'No');
          this.connector.avatar(function (avatar) {
            $('section#success img#avatar').attr('src', avatar);
          });
          Lungo.Router.section('success');
        }
        this.sync(cb.bind(this));
      }.bind(this)
    });
  }
  
  // Connect
  this.connect = function () {
    if (this.connector.connected()) {
      this.connector.start();
      this.sendQFlush();
      this.allRender();
    } else {
      if (navigator.onLine){
        this.connector.connect({
          connected: function () {
            var cb = function () {
              App.audio('login');
              this.connector.start();
              this.sendQFlush();
              this.allRender();
            }
            this.sync(cb.bind(this));
          }.bind(this)
        });
      }
    }
  }
  
  // Download roster and register callbacks for roster updates handling
  this.sync = function (callback) {
    this.connector.sync(callback);
  }
  
  // Bring account to foreground
  this.show = function () {
    $('section#main').data('user', this.core.user);
    $('section#main').data('provider', this.core.provider);
    $('section#main header').style('background', this.connector.provider.color);
    var vCard = $(this.connector.vcard);
    var address = ( vCard.length && vCard.find('FN').length ) ? vCard.find('FN').text() : this.core.user;
    $('section#main footer').data('jid', this.core.user);
    $('section#main footer .address').text(address);
    this.connector.avatar(function (avatar) {
      $('section#main footer .avatar img').attr('src', avatar);
      $('section#me .avatar img').attr('src', avatar);
    });
    $('section#main article ul[data-provider="' + this.core.provider + '"][data-user="' + this.core.user + '"]').show().siblings('ul').hide();
    var index = Accounts.find(this.core.user, this.core.provider);
    $('aside#accounts .indicator').style('top', (6.25+4.5*index)+'rem').show();
    Lungo.Element.count('section#main header nav button[data-view-article="chats"]', this.unread);
    var lacks = Providers.data[this.core.provider].lacks;
    var meSection = $('section#me').removeClass().addClass('fix head profile');
    for (var i in lacks) {
      var lack = lacks[i];
      meSection.addClass('lacks_' + lack);
    }
    meSection.find('#status input').val(this.connector.presence.status);
    meSection.find('#card .name').text(address == this.core.user ? '' : address);
    meSection.find('#card .user').text(this.core.user);
    meSection.find('#card .provider').empty().append($('<img/>').attr('src', 'img/providers/' + this.core.provider + '.svg')).append(Providers.data[this.core.provider].longname);
  }
  
  // Render everything for this account
  this.allRender = function () {
    this.accountRender();
    this.chatsRender();
    this.contactsRender();
    this.presenceRender();
    if (this.supports('vcard')) {
      this.avatarsRender();
    }
  }
  
  // Changes some styles based on presence and connection status
  this.accountRender = function () {
    var li = $('aside#accounts li[data-provider="' + this.core.provider + '"][data-user="' + this.core.user + '"]');
    li.data('connected', this.connector.connected());
    li.data('show', this.connector.presence.show);
  }
  
  // List all chats for this account
  this.chatsRender = function () {
    var account = this;
    var oldUl = $('section#main article#chats ul[data-provider="' + this.core.provider + '"][data-user="' + this.core.user + '"]');
    var ul = $("<ul />");
    ul.data('provider', account.core.provider);
    ul.data('user', account.core.user);
    ul.attr('style', oldUl.attr('style'));
    var totalUnread = 0;
    if (this.core.chats.length) {
      for (var i in this.core.chats) {
        var chat = this.core.chats[i];
        var contact = Lungo.Core.findByProperty(this.core.roster, 'jid', chat.jid);
        var title = contact.name || contact.jid;
        var lastMsg = chat.last.text ? chat.last.text : '';
        var lastStamp = chat.last.stamp ? Tools.convenientDate(chat.last.stamp).join('<br />') : '';
        var li = $('<li/>').data('jid', contact.jid);
        li.append($('<span/>').addClass('avatar').append('<img/>'));
        li.append($('<span/>').addClass('name').text(title));
        li.append($('<span/>').addClass('lastMessage').text(lastMsg));
        li.append($('<span/>').addClass('lastStamp').html(lastStamp));
        li.append($('<span/>').addClass('show').addClass('backchange'));
        li.append($('<span/>').addClass('unread').text(chat.unread));
        li.data('unread', chat.unread ? 1 : 0);
        li.bind('click', function () {
          var ci = account.chatFind(this.dataset.jid);
          if (ci >= 0) {
            var chat = account.chats[ci];
          } else { 
            var chat = new Chat({
              jid: this.dataset.jid,
              title: $(this).children('.name').text(),
              chunks: []
            }, account);
          }
          chat.show();
        }).bind('hold', function () {
          window.navigator.vibrate([100]);
          Messenger.contactProfile(this.dataset.jid);
        });
        totalUnread += chat.unread;
        ul.prepend(li);
      }
    } else {
      var span = $('<span/>').addClass('noChats')
        .append($('<strong/>').text(_('NoChats')))
        .append($('<p/>').text(_('NoChatsExplanation')));
      span.on('click', function () {
        Lungo.Router.article('main', 'contacts');
      });
      ul.prepend(span);
    }
    oldUl.replaceWith(ul);
    Lungo.Element.count('aside li[data-provider="' + this.core.provider + '"][data-user="' + this.core.user + '"]', totalUnread);
    if (ul.style('display') == 'block') {
      Lungo.Element.count('section#main header nav button[data-view-article="chats"]', totalUnread);
    }
    this.unread = totalUnread;
  }
  
  // List all contacts for this account
  this.contactsRender = function () {
    var account = this;
    var oldUl = $('section#main article#contacts ul[data-provider="' + this.core.provider + '"][data-user="' + this.core.user + '"]');
    var ul = $("<ul />");
    ul.data('provider', account.core.provider);
    ul.data('user', account.core.user);
    ul.attr('style', oldUl.attr('style'));
    for (var i in this.core.roster) {
      var contact = this.core.roster[i];
      var name = contact.name || contact.jid;
      var li = $('<li data-jid= \'' + contact.jid + '\'>'
        + '<span class=\'avatar\'><img /></span>'
        + '<span class=\'name\'>' + name + '</span>'
        + '<span class=\'show backchange\'></span>'
        + '<span class=\'status\'></span>'
        +'</li>');
      li.bind('click', function () {
        var ci = account.chatFind(this.dataset.jid);
        if (ci >= 0) {
          var chat = account.chats[ci];
        } else { 
          var chat = new Chat({
            jid: this.dataset.jid,
            title: $(this).children('.name').text(),
            chunks: []
          }, account);
        }
        chat.show();
      }).bind('hold', function () {
        window.navigator.vibrate([100]);
        Messenger.contactProfile(this.dataset.jid);
      });
      ul.append(li);
    }
    oldUl.replaceWith(ul);
  }
  
  // Render presence for every contact
  this.presenceRender = function () {
    if (this.connector.connected()) {
      for (var i in this.core.roster) {
        var contact = this.core.roster[i];
        var li = $('section#main article ul li[data-jid="'+contact.jid+'"]');
        li.data('show', contact.show || 'na');
        li.find('.status').show().text(contact.status || _('show' + (contact.show || 'na')));
        var section = $('section#chat');
        if (section.data('jid') == contact.jid) {
          section.data('show', contact.show || 'na');
          section.find('header .status').text(contact.status || _('show' + (contact.show || 'na')));
        }
      }
      $('section#main ul li span.show').show();
    } else {
      $('section#main ul li span.show').hide();
      $('section#main ul li span.status').hide();
    }
  }
  
  // Render all the avatars
  this.avatarsRender = function () {
    var account = this;
    var avatars = App.avatars;
    $('ul[data-provider="' + this.core.provider + '"][data-user="' + this.core.user + '"] span.avatar img:not([src])').each(function (i, el) {
      var jid = Strophe.getBareJidFromJid(el.parentNode.parentNode.dataset.jid);
      if (avatars[jid]) {
        Store.recover(avatars[jid], function (val) {
          if (val) {
            $(el).attr('src', val);
          }
        });
      } else if (account.connector.connected()) {
        account.connector.avatar(function (avatar) {
          $(el).attr('src', avatar);
          avatars[jid] = Store.save(avatar, function () {
            Store.put('avatars', avatars);
          });
        }, jid);
      }
    });
    var vCard = $(this.connector.vcard);
    if ($('section#main').data('provider') == account.core.provider && $('section#main').data('user') == account.core.user) {
      account.connector.avatar(function (avatar) {
        $('section#main footer .avatar img').attr('src', avatar);
        $('section#me .avatar img').attr('src', avatar);
      });
      var address = ( vCard.length && vCard.find('FN').length ) ? vCard.find('FN').text() : this.core.user;
      $('section#main footer .address').text(address);
      $('section#me #card .name').text(address == this.core.user ? '' : address);
    }
  }
    
  // Push message to sendQ
  this.toSendQ = function (storageIndex) {
    if (!this.core.sendQ) {
      this.core.sendQ = [];
    }
    this.core.sendQ.push(storageIndex);
    this.save();
  }
  
  // Send every message in SendQ
  this.sendQFlush = function () {
    var account = this;
    if (this.core.sendQ.length) {
      var sendQ = this.core.sendQ;
      var block = sendQ[0][0];
      Store.recover(block, function (data) {
        var content = data[sendQ[0][1]];
        var msg = new Message(account, {
          from: content.from,
          to: content.to,
          text: content.text,
          stamp: content.stamp
        });
        msg.send(true, true);
        sendQ.splice(0, 1);
        account.sendQFlush();
      });
    } else {
      this.save();
    }
  }
  
  // Find chat in chat array
  this.chatFind = function (jid) {
    var index = -1;
    for (var i in this.chats) {
      if (this.chats[i].core.jid == jid) {
        index = i;
        break;
      }
    }
    return index;
  }
    
  // Check for feature support
  this.supports = function (feature) {
    return !this.connector.provider.lacks || this.connector.provider.lacks.indexOf(feature) < 0;
  }
  
  // Save to store
  this.save = function () {
    var index = Accounts.find(this.core.user, this.core.provider);
    App.accountsCores[index] = this.core;
    App.smartupdate('accountsCores');
  }

}

var Accounts = {

  // Find the index of an account
  find: function (user, provider) {
    var index = -1;
    for (var i in App.accountsCores) {
      var account = App.accountsCores[i];
      if (account.user == user && account.provider == provider) {
        index = i;
        break;
      }
    }
    return index;
  },
  
  // Create accounts icons
  aside: function () {
    var ul = $('aside#accounts ul');
    ul.empty();
    for (var i in App.accounts) {
      var account = App.accounts[i];
      var li = $('<li/>').data('user', account.core.user).data('provider', account.core.provider);
      var button = $('<button/>').addClass('account').on('click', function () {
        var index = Accounts.find(this.parentNode.dataset.user, this.parentNode.dataset.provider);
        if (index) {
          App.accounts[index].show();
        }
      });
      var img = $('<img/>').attr('src', 'img/providers/squares/' + account.core.provider + '.svg');
      ul.append(li.append(button.append(img)));
    }
  },
  
  // Create main sections 
  main: function () {
    var chats = $('section#main article#chats').empty();
    var contacts = $('section#main article#contacts').empty();
    for (var i in App.accounts) {
      var account = App.accounts[i];
      chats.append($("<ul/>").data('provider', account.core.provider).data('user', account.core.user));
      contacts.append($("<ul/>").data('provider', account.core.provider).data('user', account.core.user));
      account.allRender();
    }
  }
  
}
