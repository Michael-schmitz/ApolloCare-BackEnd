const { doQuery } = require('../db');
const { GenerateAuthToken, ValidateLogin, ValidateDuoCode } = require('../models/user');
const constants = require('../utils/constants');
const mail = require('../utils/mail');
const bcrypt = require('bcryptjs');
const pwGenerator = require('generate-password');
const empty = require('is-empty');
const winston = require('winston');
const express = require('express');
const router = express.Router();
const verifyGoogleToken = require('../utils/verifyGoogleToken');

// Login User
router.post('/', async (req, res) => {
    // Validate information in request
    const { error } = ValidateLogin(req.body);
    if(error) return res.status(400).send({ error: error.details[0].message });


    // Make sure email is already 
    // in proper database table!!
    let query = `SELECT * FROM ${constants.userTypeToTableName(req.body.userType)} WHERE email='${req.body.email}';`;
    doQuery(res, query, [], async function(selectData) {
        const user = empty(selectData.recordset) ? {} : selectData.recordset[0];
        if (empty(user)) return res.status(400).send({ error: `Invalid login credentials.` });
        
        // Check password is correct
        bcrypt.compare(req.body.pword, user.pword)
        .then(async (isMatch) => {
            if (!isMatch) return res.status(400).send({ error: `Invalid login credentials.` });
        
            // Create duo code
            const duoCode = pwGenerator.generate({
                length: 6,
                numbers: true,
                uppercase: true,
                lowercase: false,
                symbols: false
            });
                                
            // Hashed it for frontend transmission
            const salt = await bcrypt.genSalt(11);
            hashedDuoCode = await bcrypt.hash(duoCode, salt);

            // Uncomment if testing login/duo auth
            winston.info(duoCode);
            winston.info(hashedDuoCode);
            
            // Send email to user with duo code
            mail(user.email, "2FA Login Code!", duoEmail.replace("_FIRST_NAME_", user.fname).replace("_LAST_NAME_", user.lname).replace("_DUO_CODE_", duoCode))
            .then(()=> {
                    return res.status(200).send({ email: user.email, userType: req.body.userType, hashedDuoCode: hashedDuoCode });
            }).catch( ()=> {
                return res.status(500).send({ error: `2FA Code Email failed to send.` });
            });   
        });
    });
});

// Duo Auth for User
router.post('/duoauth', async (req, res) => {
    // Validate information in request
    const { error } = ValidateDuoCode(req.body);
    if(error) return res.status(400).send({ error: error.details[0].message });


    // Make sure email is already in proper database table!!
    let query = `SELECT * FROM ${constants.userTypeToTableName(req.body.userType)} WHERE email='${req.body.email}';`;
    doQuery(res, query, [], async function(data) {
        const user = empty(data.recordset) ? {} : data.recordset[0];

        if (empty(user)) {
            return res.status(400).send({ error: `Email was invalid.` });
        } else {
            // Check duo code is correct
            bcrypt.compare(req.body.duo, req.body.hashedDuoCode)
            .then(isMatch => {
                if (!isMatch) {
                    return res.status(400).send({error: `Invalid 2FA code.`});
                } else {
                    
                    winston.info(user['id']);
                    winston.info(req.body.userType);
                    // Return authenication token
                     const token = GenerateAuthToken({
                         id: user['id'],
                         userType: req.body.userType,
                         exp: 3600
                    });
                    res.status(200).send( { token: token} );
                }
            });
        }
    });
});

router.get('/google/:id', async (req, res) => {
    verifyGoogleToken(req.body.tokenId)
    .then(function(result) {
        let query = `SELECT * FROM ${constants.userTypeToTableName(req.body.userType)} WHERE goauth='${result.sub}';`;
        let params = [];
        doQuery(res, query, params, async function(data) {
            if(empty(data.recordset)) {
                //add new user with sub id
                let query2 = `INSERT INTO ${constants.userTypeToTableName(req.body.userType)} (email, fname, lname, goauth)
                             OUTPUT INSERTED.*
                             VALUES ('${result.email}', '${result.given_name}', '${result.family_name}', ${result.sub});`
                let params2 = [
                    {name: 'id', sqltype: sql.Int, value: req.body.id},
                ];
                doQuery(res, query2, params2, async function(insertData) {
                    if(empty(insertData.recordset)) {
                        res.status(401).send({error: "User not registered."});
                    } else {
                        const user = insertData.recordset[0]; 
                        const duoCode = pwGenerator.generate({
                            length: 6,
                            numbers: true,
                            uppercase: true,
                            lowercase: false,
                            symbols: false
                        });
                                            
                        // Hashed it for frontend transmission
                        const salt = await bcrypt.genSalt(11);
                        hashedDuoCode = await bcrypt.hash(duoCode, salt);
                        
                        // Send email to user with duo code
                        mail(user.email, "2FA Login Code!", duoEmail.replace("_FIRST_NAME_", user.fname).replace("_LAST_NAME_", user.lname).replace("_DUO_CODE_", duoCode))
                        .then(()=> {
                            return res.status(200).send({ email: user.email, userType: req.body.userType, hashedDuoCode: hashedDuoCode });
                        }).catch( ()=> {
                            return res.status(500).send({ error: `2FA Code Email failed to send.` });
                        });   
                    }
                });
            } else {
                const user = data.recordset[0]; 
                const duoCode = pwGenerator.generate({
                    length: 6,
                    numbers: true,
                    uppercase: true,
                    lowercase: false,
                    symbols: false
                });
                                    
                // Hashed it for frontend transmission
                const salt = await bcrypt.genSalt(11);
                hashedDuoCode = await bcrypt.hash(duoCode, salt);

                // Uncomment if testing login/duo auth
                // winston.info(duoCode);
                // winston.info(hashedDuoCode);
                
                // Send email to user with duo code
                mail(user.email, "2FA Login Code!", duoEmail.replace("_FIRST_NAME_", user.fname).replace("_LAST_NAME_", user.lname).replace("_DUO_CODE_", duoCode))
                .then(()=> {
                    return res.status(200).send({ email: user.email, userType: req.body.userType, hashedDuoCode: hashedDuoCode });
                }).catch( ()=> {
                    return res.status(500).send({ error: `2FA Code Email failed to send.` });
                });   
            }
        });
    })
    .catch(function(error){
        res.status(401).send( {error: "Token not valid." })
    });

});

module.exports = router;

const duoEmail = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office" style="width:100%;font-family:arial, 'helvetica neue', helvetica, sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0"><head><meta charset="UTF-8"><meta content="width=device-width, initial-scale=1" name="viewport"><meta name="x-apple-disable-message-reformatting"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta content="telephone=no" name="format-detection"><title>New email</title> <!--[if (mso 16)]><style type="text/css">     a {text-decoration: none;}     </style><![endif]--> <!--[if gte mso 9]><style>sup { font-size: 100% !important; }</style><![endif]--> <!--[if gte mso 9]><xml> <o:OfficeDocumentSettings> <o:AllowPNG></o:AllowPNG> <o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings> </xml><![endif]--><style type="text/css">
#outlook a {	padding:0;}.ExternalClass {	width:100%;}.ExternalClass,.ExternalClass p,.ExternalClass span,.ExternalClass font,.ExternalClass td,.ExternalClass div {	line-height:100%;}.es-button {	mso-style-priority:100!important;	text-decoration:none!important;}a[x-apple-data-detectors] {	color:inherit!important;	text-decoration:none!important;	font-size:inherit!important;	font-family:inherit!important;	font-weight:inherit!important;	line-height:inherit!important;}.es-desk-hidden {	display:none;	float:left;	overflow:hidden;	width:0;	max-height:0;	line-height:0;	mso-hide:all;}@media only screen and (max-width:600px) {p, ul li, ol li, a { font-size:16px!important; line-height:150%!important } h1 { font-size:30px!important; text-align:center; line-height:120%!important } h2 { font-size:26px!important; text-align:center; line-height:120%!important } h3 { font-size:20px!important; text-align:center; line-height:120%!important } h1 a { 
font-size:30px!important } h2 a { font-size:26px!important } h3 a { font-size:20px!important } .es-menu td a { font-size:16px!important } .es-header-body p, .es-header-body ul li, .es-header-body ol li, .es-header-body a { font-size:16px!important } .es-footer-body p, .es-footer-body ul li, .es-footer-body ol li, .es-footer-body a { font-size:16px!important } .es-infoblock p, .es-infoblock ul li, .es-infoblock ol li, .es-infoblock a { font-size:12px!important } *[class="gmail-fix"] { display:none!important } .es-m-txt-c, .es-m-txt-c h1, .es-m-txt-c h2, .es-m-txt-c h3 { text-align:center!important } .es-m-txt-r, .es-m-txt-r h1, .es-m-txt-r h2, .es-m-txt-r h3 { text-align:right!important } .es-m-txt-l, .es-m-txt-l h1, .es-m-txt-l h2, .es-m-txt-l h3 { text-align:left!important } .es-m-txt-r img, .es-m-txt-c img, .es-m-txt-l img { display:inline!important } .es-button-border { display:block!important } a.es-button { 
font-size:20px!important; display:block!important; border-width:10px 0px 10px 0px!important } .es-btn-fw { border-width:10px 0px!important; text-align:center!important } .es-adaptive table, .es-btn-fw, .es-btn-fw-brdr, .es-left, .es-right { width:100%!important } .es-content table, .es-header table, .es-footer table, .es-content, .es-footer, .es-header { width:100%!important; max-width:600px!important } .es-adapt-td { display:block!important; width:100%!important } .adapt-img { width:100%!important; height:auto!important } .es-m-p0 { padding:0px!important } .es-m-p0r { padding-right:0px!important } .es-m-p0l { padding-left:0px!important } .es-m-p0t { padding-top:0px!important } .es-m-p0b { padding-bottom:0!important } .es-m-p20b { padding-bottom:20px!important } .es-mobile-hidden, .es-hidden { display:none!important } tr.es-desk-hidden, td.es-desk-hidden, table.es-desk-hidden { width:auto!important; overflow:visible!important; 
float:none!important; max-height:inherit!important; line-height:inherit!important } tr.es-desk-hidden { display:table-row!important } table.es-desk-hidden { display:table!important } td.es-desk-menu-hidden { display:table-cell!important } .es-menu td { width:1%!important } table.es-table-not-adapt, .esd-block-html table { width:auto!important } table.es-social { display:inline-block!important } table.es-social td { display:inline-block!important } }</style></head><body style="width:100%;font-family:arial, 'helvetica neue', helvetica, sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0"><div class="es-wrapper-color" style="background-color:#F6F6F6"> <!--[if gte mso 9]><v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t"> <v:fill type="tile" color="#f6f6f6"></v:fill> </v:background><![endif]-->
<table class="es-wrapper" width="100%" cellspacing="0" cellpadding="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;padding:0;Margin:0;width:100%;height:100%;background-repeat:repeat;background-position:center top"><tr style="border-collapse:collapse"><td valign="top" style="padding:0;Margin:0"><table class="es-content" cellspacing="0" cellpadding="0" align="center" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;table-layout:fixed !important;width:100%"><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><table class="es-content-body" cellspacing="0" cellpadding="0" bgcolor="#ffffff" align="center" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFFFFF;width:600px"><tr style="border-collapse:collapse">
<td align="left" style="Margin:0;padding-top:20px;padding-bottom:20px;padding-left:20px;padding-right:20px"><table width="100%" cellspacing="0" cellpadding="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tr style="border-collapse:collapse"><td valign="top" align="center" style="padding:0;Margin:0;width:560px"><table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tr style="border-collapse:collapse"><td align="left" style="padding:0;Margin:0;padding-bottom:15px"><h2 style="Margin:0;line-height:29px;mso-line-height-rule:exactly;font-family:arial, 'helvetica neue', helvetica, sans-serif;font-size:24px;font-style:normal;font-weight:normal;color:#333333">Hello _FIRST_NAME_ _LAST_NAME_</h2></td></tr><tr style="border-collapse:collapse">
<td align="left" style="padding:0;Margin:0;padding-top:20px"><p style="Margin:0;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;font-size:14px;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;color:#333333">Here is your 2FA code!<br><br><strong><span style="font-size:24px">_DUO_CODE_<br><br></span></strong><span style="font-size:24px"><span style="font-size:14px">Please use the above code to finish your login process.<br><br>Be safe and healthy!<br><br>Love,<br>The ApolloCare Item Team</span><span style="font-size:12px"></span></span><br></p></td></tr></table></td></tr></table></td></tr></table></td></tr></table>
<table class="es-footer" cellspacing="0" cellpadding="0" align="center" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;table-layout:fixed !important;width:100%;background-color:transparent;background-repeat:repeat;background-position:center top"><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0"><table class="es-footer-body" cellspacing="0" cellpadding="0" align="center" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:transparent;width:600px"><tr style="border-collapse:collapse"><td align="left" style="Margin:0;padding-top:20px;padding-bottom:20px;padding-left:20px;padding-right:20px"><table width="100%" cellspacing="0" cellpadding="0" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tr style="border-collapse:collapse">
<td valign="top" align="center" style="padding:0;Margin:0;width:560px"><table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tr style="border-collapse:collapse"><td style="padding:20px;Margin:0;font-size:0" align="center"><table width="75%" height="100%" cellspacing="0" cellpadding="0" border="0" role="presentation" style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px"><tr style="border-collapse:collapse"><td style="padding:0;Margin:0;border-bottom:1px solid #CCCCCC;background:none;height:1px;width:100%;margin:0px"></td></tr></table></td></tr><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px">
<p style="Margin:0;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;font-size:11px;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:17px;color:#333333">&lt;3 ApolloCare loves you and wants you to be healthy &lt;3<br></p></td></tr><tr style="border-collapse:collapse"><td align="center" style="padding:0;Margin:0;padding-top:10px;padding-bottom:10px"><p style="Margin:0;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;font-size:11px;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:17px;color:#333333">© 2020 ApolloCare<br></p></td></tr></table></td></tr></table></td></tr></table></td></tr></table></td></tr></table></div></body>
</html>
`