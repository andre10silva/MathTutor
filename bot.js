// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory, TurnContext } = require('botbuilder');
const { MathTutor} = require('./componentsDialogs/mathTutor');
// const { QuestionsDialog } = require('./componentsDialogs/questionsDialog');

class EchoBot extends ActivityHandler {
    constructor(conversationState, userState) {
        super();

        this.conversationState = conversationState;
        this.userState = userState;
        this.dialogState = conversationState.createProperty("dialogState");
        this.mathTutor = new MathTutor(this.conversationState, this.userState);
        // this.questionsDialog = new QuestionsDialog(this.conversationState, this.userState)

        this.previousIntent = this.conversationState.createProperty("previousIntent");
        this.conversationData = this.conversationState.createProperty("conversationData");

        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        this.onMessage(async (context, next) => {
            
            await this.dispatchToIntentAsync(context);
            await next();
        }, true);

        this.onDialog(async (context, next) => {

            await this.conversationState.saveChanges(context, false);
            await this.userState.saveChanges(context, false);
            await next();
        })

        this.onMembersAdded(async (context, next) => {
            await this.sendWelcomeMessage(context);
            await next();
        });
    }

    async sendWelcomeMessage(context){
        const {activity} = context;

        for (const idx in activity.membersAdded){
            if(activity.membersAdded[idx].id !== activity.recipient.id){
                const welcomeMessage = `Olá! Bem-vindo(a) ao bot de apoio ao estudo da Matemática! Aqui vais poder testar os teus conhecimentos e aprender novas coisas. Vamos começar?`;
                await context.sendActivity(welcomeMessage);
                await this.dispatchToIntentAsync(context);                
            }
        }
    }

    async dispatchToIntentAsync(context){  
        /// Remove o switch e chama a função this.mathTutor.run diretamente
        await this.conversationData.set(context, { endDialog: false });
        await this.mathTutor.run(context, this.dialogState);
        const conversationData = await this.conversationData.get(context, {});
   
        conversationData.endDialog = await this.mathTutor.isDialogComplete();

        // if (conversationData.endDialog) {
        //     // If the MathTutor dialog is complete, switch to the QuestionsDialog
        //     await this.questionsDialog.run(context, this.dialogState);
        //     conversationData.endDialog = await this.questionsDialog.isDialogComplete();
        // } else {
        //     // If the MathTutor dialog is not complete, continue with it
        //     await this.mathTutor.run(context, this.dialogState);
        //     conversationData.endDialog = await this.mathTutor.isDialogComplete();
        // }

        await this.conversationData.set(context, conversationData);
    }
}

module.exports.EchoBot = EchoBot;

// const { ActivityHandler, MessageFactory } = require('botbuilder');
// const { DialogSet } = require('botbuilder-dialogs');
// const { MathTutor } = require('./componentsDialogs/mathTutor');
// const { QuestionDialog } = require('./componentsDialogs/questionsDialog');


// class EchoBot extends ActivityHandler {
//     constructor(conversationState, userState) {
//       super();
  
//       this.conversationState = conversationState;
//       this.userState = userState;
  
//       // Create a dialog set object
//       this.dialogState = this.conversationState.createProperty('dialogState');
//       this.dialogs = new DialogSet(this.dialogState);

  
//       // Add the dialogs to the set
//       this.dialogs.add(new MathTutor('MathTutor'));
//       this.dialogs.add(new QuestionDialog('QuestionDialog'));


//         // Set up activity handlers
//         this.onMessage(async (context, next) => {
//             await this.dispatchToDialogAsync(context);
//             await next();
//         });

//         this.onDialog(async (context, next) => {
//             await this.conversationState.saveChanges(context, false);
//             await this.userState.saveChanges(context, false);
//             await next();
//         });

//         this.onMembersAdded(async (context, next) => {
//             await this.sendWelcomeMessage(context);
//             await next();
//         });
//     }

//     async sendWelcomeMessage(context) {
//         const { activity } = context;
//         for (const idx in activity.membersAdded) {
//             if (activity.membersAdded[idx].id !== activity.recipient.id) {
//                 const welcomeMessage = `Bem-vindo ao bot de suporte a Matemática`;
//                 await context.sendActivity(MessageFactory.text(welcomeMessage));
//                 await this.dispatchToDialogAsync(context);
//             }
//         }
//     }

//     async dispatchToDialogAsync(context) {
//         const dialogContext = await this.dialogs.createContext(context);
      
//         await dialogContext.continueDialog();
//         if (!context.responded) {
//           await dialogContext.beginDialog('MathTutor');
//         }
      
//         await dialogContext.continueDialog();
//         if (!context.responded) {
//           await dialogContext.beginDialog('QuestionDialog');
//         }
      
//         const conversationData = await this.conversationData.get(context, {});
//         conversationData.endDialog = await dialogContext.activeDialog ? false : true;
//       }
      
    
// }

// module.exports.EchoBot = EchoBot;