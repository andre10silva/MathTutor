const { MongoClient } = require('mongodb');

const { WaterfallDialog, ComponentDialog } = require ('botbuilder-dialogs');
const { ConfirmPrompt, ChoicePrompt, DateTimePrompt, NumberPrompt, TextPrompt, ChoiceFactory } = require('botbuilder-dialogs');
const { DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');
const { ActionTypes } = require('botbuilder');

const path = require('path');

const databaseName = 'MathTutor';
const uri = 'mongodb+srv://dbMathTutor:qTMCLlsrziJX62Gp@cluster0.rzeclhi.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// DECLARAÇÃO DA VARIÁVEL PARA ACEDER ÀS PERGUNTAS E RESPOSTA DA COLEÇÃO 'QUESTIONS' DO MONGODB
const db = client.db(databaseName);
const questionsCollection = db.collection("questions");
const usersCollection = db.collection("users");
const videosCollection = db.collection("videos");
const questionsTypeCollection = db.collection("questionsType");
const setQuestionsTypeCollection = db.collection("setQuestionsType");
const documentsCollection = db.collection("documents");

const CHOICE_PROMPT    = 'CHOICE_PROMPT';
const CONFIRM_PROMPT   = 'CONFIRM_PROMPT';
const TEXT_PROMPT      = 'TEXT_PROMPT';
const NUMBER_PROMPT    = 'NUMBER_PROMPT';
const DATETIME_PROMPT  = 'DATETIME_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_DIALOG';
var endDialog = '';

// const QUESTIONS_PROPERTY = 'questions';

let score = 0;
let scoreNewTest = 0;

const dialogSet = new DialogSet();
dialogSet.add(new ChoicePrompt(CHOICE_PROMPT));


/// Função para fazer perguntas genéricas
async function askQuestion(step, questionType, questionNumber) {
    try {
      // Aguarda a resolução da promessa retornada por toArray()
      const questions = await questionsCollection.aggregate([
        {
          $lookup: {
            from: "questionsType",
            localField: "type",
            foreignField: "_id",
            as: "type",
          },
        },
        {
          $match: { "type.name": questionType },
        },
        {
          $sample: { size: 1 },
        },
      ]).toArray();
  
      // Verifica se encontrou alguma pergunta
      if (questions.length === 0) {
        step.context.sendActivity(
          `Não há perguntas do tipo '${questionType}'.`
        );
        return step.endDialog();
      }
  
      const shuffledQuestions = shuffleArray(questions); // Embaralha as perguntas para evitar a repetição de perguntas
      const question = shuffledQuestions[0]; // Seleciona a primeira pergunta da lista embaralhada
      step.values[`currentQuestion_${questionNumber}`] = question; // Armazena a pergunta atual no objeto de valores do diálogo
  
      // Define as opções para a exibição da pergunta
      const promptOptions = {
        prompt: question.question,
        choices: question.answer.map((answer) => answer.text),
        retryPrompt: "Selecione uma das opções",
        style: ActionTypes.ImBack,
      };
      // Mostra a pergunta e espera pela resposta do usuário
      return step.prompt(CHOICE_PROMPT, promptOptions);
    } catch (error) {
      console.error(error);
      throw new Error("Erro ao obter perguntas base de dados.");
    }
}


// Lista de perguntas embaralhadas
let shuffledQuestions;

// Embaralha as perguntas
async function shuffleQuestions() {
  const questions = await questionsCollection.find({}).toArray();
  shuffledQuestions = shuffleArray(questions);
}

// Retorna a próxima pergunta para ser exibida
function getNextQuestion() {
  return shuffledQuestions.shift();
}

// Embaralha um array
function shuffleArray(array) {
  const shuffledArray = array.slice();
  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }
  return shuffledArray;
}

// Inicia o processo de embaralhamento das perguntas quando o bot é iniciado
shuffleQuestions();

// Obtém o link do video da base de dados dependendo do tipo de pergunta
async function getVideoLink(category) {
  const videos = await videosCollection.aggregate([
    {
      $lookup: {
        from: "questionsType",
        localField: "type",
        foreignField: "_id",
        as: "type",
      },
    },
  ]).toArray();

  const matchingVideo = videos.find(video => video.type[0].name === category);

  if (matchingVideo) {
    return matchingVideo.link;
  } else {
    // Vídeo genérico caso não haja uma categoria correspondente
    return videos[0].link;
  }
}

async function getDocumentLink(category) {
  const documents = await documentsCollection.aggregate([
    {
      $lookup: {
        from: "questionsType",
        localField: "type",
        foreignField: "_id",
        as: "type",
      },
    },
  ]).toArray();

  const matchingDoc = documents.find(doc => doc.type[0].name === category);

  if (matchingDoc) {
    return matchingDoc;
  } else {
    // Vídeo genérico caso não haja uma categoria correspondente
    return doc[0].link;
  }
}

// ENCONTRA QUAL O TIPO DE QUESTÃO SELECIONA NA BD
async function questionType (questionType) {

    // Aguarda a resolução da promessa retornada por toArray()
    const setQuestionsType = await setQuestionsTypeCollection.aggregate([
      {
        $lookup: {
          from: "questionsType",
          localField: "questionType",
          foreignField: "_id",
          as: "type",
        },
      },
      {
        $match: { "type.name": questionTypeName },
      },
      {
        $sample: { size: 1 },
      },
    ]).toArray();

    return setQuestionsType;
}

 

class MathTutor extends ComponentDialog {

    constructor(conversationState, userState){
        super('mathTutor');        

        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT));
        this.addDialog(new DateTimePrompt(DATETIME_PROMPT));

        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            this.start.bind(this),
            this.login.bind(this),
            this.validateEmail.bind(this),
            this.loginStep2.bind(this),
            this.loginStep3.bind(this),
            this.loginStep4.bind(this),
            this.loginStep5.bind(this),
            this.confirmStep.bind(this),
            this.summaryStep.bind(this),
            this.questions.bind(this),
            this.questions_1.bind(this),
            this.answerQuestion_1.bind(this),
            this.questions_2.bind(this),
            this.answerQuestion_2.bind(this),
            this.questions_3.bind(this),
            this.answerQuestion_3.bind(this),
            this.questions_4.bind(this),
            this.answerQuestion_4.bind(this),
            this.questions_5.bind(this),
            this.answerQuestion_5.bind(this),
            this.questions_6.bind(this),
            this.answerQuestion_6.bind(this),
            this.questions_7.bind(this),
            this.answerQuestion_7.bind(this),
            this.questions_8.bind(this),
            this.answerQuestion_8.bind(this),
            this.resultsAnswers.bind(this),
            this.videos.bind(this),
            this.nextStepPrompt.bind(this),
            this.nextStep.bind(this),
            this.documents.bind(this),
            this.newTest.bind(this),
            this.newTest_1.bind(this),
            this.answerNewTest_1.bind(this),
            this.newTest_2.bind(this),
            this.answerNewTest_2.bind(this),
            this.newTest_3.bind(this),
            this.answerNewTest_3.bind(this),
            this.newTest_4.bind(this),
            this.answerNewTest_4.bind(this),
            this.newTest_5.bind(this),
            this.answerNewTest_5.bind(this),
            this.newTest_6.bind(this),
            this.answerNewTest_6.bind(this),
            this.resultsAnswersNewTest.bind(this),
            // this.saveResults.bind(this),
            this.isDialogComplete.bind(this),            
        ]));

        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    async run(turnContext, accessor){
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);
        
        await client.connect();
        
        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty){
            await dialogContext.beginDialog(this.id);
        }
    }
    
    async start(step) {
      return await step.prompt(CHOICE_PROMPT, {
          prompt: 'Escolha uma das opções:',
          choices: ChoiceFactory.toChoices(['Iniciar Sessão', 'Criar conta'])
      });
    }

    async login(step) {
        step.values.choice = step.result.value;
        
        if (step.values.choice === 'Iniciar Sessão') {
            return await step.prompt(TEXT_PROMPT, 'Insira o email:');
        } else {
            return await step.prompt(TEXT_PROMPT, 'Insira o seu nome:');
        }
    }

    async validateEmail(step) {

      if (step.values.choice === 'Iniciar Sessão') {
          step.values.emailLogin = step.result && step.result.value;
          const emailLogin = step.context.activity.text
        
          // Consulta na base de dados se o email já existe
          const emailExists = await usersCollection.findOne({ email: emailLogin });
          
          if (emailExists) {
            // O email já existe na base de dados, pode prosseguir com o processo de autenticação
            return await step.next();
          } else {
            // O email não existe na base de dados, retorna uma mensagem para o utilizador
            await step.context.sendActivity('O email fornecido não está registado. Por favor, verifique o email ou crie uma nova conta.');
            // Encerre o diálogo ou redirecione para uma etapa anterior, se necessário
            return await step.endDialog();
          }

      }else{
        step.values.name = step.result;
        return await step.next();
      }    
    }
    

  async loginStep2(step) {
    
    if (step.values.choice === 'Iniciar Sessão') {
      return await step.next();
      
    } else {
      return await step.prompt(NUMBER_PROMPT, 'Insira o número de estudante:');  
    }
  }

  async loginStep3(step) {
    step.values.number = step.result;

    if (step.values.choice === 'Iniciar Sessão') {
      return await step.next();
      
    } else {
      return await step.prompt(TEXT_PROMPT, 'Insira o email:');
    }
  }

  async loginStep4(step) {
    step.values.email = step.result;

    if (step.values.choice === 'Iniciar Sessão') {
      return await step.next();
      
    } else {
      return await step.prompt(CHOICE_PROMPT, {
        prompt: 'Qual é o seu ciclo de estudos?',
        choices: ChoiceFactory.toChoices(['CTeSP', 'Licenciatura'])
    });
    }
  }

  async loginStep5(step) {
    step.values.cycleOfStudies = step.result;
    if (step.values.choice === 'Iniciar Sessão') {
      return await step.next();
      
    } else {
      step.values.cycleOfStudies = step.result.value;
      const cycleOfStudies = step.result.value;
      let coursePrompt;
      switch (cycleOfStudies) {
          case 'CTeSP':
              coursePrompt = {
                  prompt: 'Qual é o teu curso?',
                  choices: ['Contabilidade e Fiscalidade', 'Eletrónica e Automação Industrial', 'Energias Renováveis e Eficiência Energética', 'Gestão de PME', 'Gestão de Turismo', 'Gestão e Informática Aplicada aos Negócios', 'Marketing Digital', 'Redes e Sistemas Informáticos', 'Tecnologia Mecatrónica', 'Tecnologias e Programação de Sistemas de Informação']
              };
              break;
          case 'Licenciatura':
              coursePrompt = {
                  prompt: 'Qual é o teu curso?',
                  choices: ['Engenharia Informática', 'Engenharia Mecânica', 'Engenharia Eletrónica e de Automação', 'Contabilidade', 'Gestão', 'Turismo e Negócios Sustentáveis']
              };
              break;
          default:
              break;
      }
      return await step.prompt(CHOICE_PROMPT, coursePrompt);
    }
  }


    async confirmStep(step){ 
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua após 2 segundos
        step.values.course = step.result.value;       

        var msg = `
        Registo criado!
 
        Nome:    ${step.values.name}
        Número:  ${step.values.number}
        Email:   ${step.values.email}
        Ensino:  ${step.values.cycleOfStudies}
        Curso:   ${step.values.course}
        `;

        await step.context.sendActivity(msg);
        return await step.prompt(CHOICE_PROMPT, 'Os dados estão corretos?', ["Sim", "Não"]); 
    }

    async summaryStep(step) {
      
      console.log(step.result);
        if (step.result.value === "Sim"){                
            try {
                // Connect to MongoDB server
                await client.connect();
                // console.log('Connected to MongoDB');
                
                // ### GUARDA NA COLEÇÃO USERS OS DADOS DO UTILIZADOR ###

                // Select database and collection
                const database = client.db(databaseName);
                const collection = database.collection("users");
        
                // Create a new document to be inserted into the collection
                const newDoc = {
                    name: step.values.name,
                    number: step.values.number,
                    email: step.values.email,
                    cycleOfStudies: step.values.cycleOfStudies,
                    course: step.values.course
                };                  
        
                // Insert the new document into the collection
                const result = await collection.insertOne(newDoc);
                console.log(`${result.insertedCount} document(s) inserted into the collection`);

                return await step.next();

            } catch (err) {
                console.error(err);
            }
      }else{
          // FALTA FAZER O ELSE!!
      }
    }
      

    async questions(step) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Continua após 2 segundos
      if (step.values.choice === 'Iniciar Sessão') {
         // Realize uma consulta na base de dados para verificar se o email já existe
         const userName = await usersCollection.findOne({email: step.values.emailLogin});
         await step.context.sendActivity(`Bem-vindo ${userName.name}!`)
      }else{
        await step.context.sendActivity(`Bem-vindo ${step.values.name}!`)
      }
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua após 2 segundos
        await step.context.sendActivity("Vou fazer algumas perguntas sobre diversos conteúdos e só precisas de escolher a opção correta. Não te preocupes se não souberes a resposta de alguma pergunta. Podes sempre tentar novamente. Vamos lá começar!");
        return await step.next();
    }   
    
    // PERGUNTA 1
    async questions_1(step) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    
      const setQuestionType = await setQuestionsTypeCollection.findOne({}); //Encontra todos os registos
      const questionTypeId = setQuestionType.questionType; //Filtra pelo ID na coleção setQuestionsType
    
      const questionTypeResult = await questionsTypeCollection.findOne({_id: questionTypeId}); //Encontra na coleção o registo cujo o id da coleção questionsType é igual ao da coleção setQuestions
      const questionType = questionTypeResult.name; //Guarda só o nome desse registo.
    
      return await askQuestion(step, questionType, "1");
    }
    
    
    // VERIFICA SE A RESPOSTA ESTÁ CERTA OU ERRADA
    async answerQuestion_1(step) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua para o próximo método após 2 segundos
        const userAnswer = step.result.value;
        const question = step.values.currentQuestion_1;
      
        if (userAnswer && userAnswer.toLowerCase() === question.answer.find(answer => answer.correct).text.toLowerCase()) {
          await step.context.sendActivity("Resposta correta!");
          score += 1;
          step.values.answer1 = 1;
          step.values.scoreQuadratic += 1; // incrementa a pontuação de perguntas de funções quadráticas
        } else {
          await step.context.sendActivity(`Resposta errada! A resposta certa é ${question.answer.find(answer => answer.correct).text.toLowerCase()}`);
          step.values.answer1 = 0;
        }

        return await step.next();
    }
      
    
    // PERGUNTA 2
    async questions_2(step) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const setQuestionType = await setQuestionsTypeCollection.findOne({}, { skip: 1 });
      const questionTypeId = setQuestionType.questionType;
      
      const questionTypeResult = await questionsTypeCollection.findOne({ _id: questionTypeId });
      const questionType = questionTypeResult.name;
      
      return await askQuestion(step, questionType, "2");
    }
    
    
    // VERIFICA SE A RESPOSTA ESTÁ CERTA OU ERRADA
    async answerQuestion_2(step) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua para o próximo método após 2 segundos
        const userAnswer = step.result.value;
        const question = step.values.currentQuestion_2;
      
        if (userAnswer && userAnswer.toLowerCase() === question.answer.find(answer => answer.correct).text.toLowerCase()) {
          await step.context.sendActivity("Resposta correta!");
          score += 1;
          step.values.answer2 = 1;
          step.values.scoreQuadratic += 1; // incrementa a pontuação de perguntas de funções quadráticas
        } else {
          await step.context.sendActivity(`Resposta errada! A resposta certa é ${question.answer.find(answer => answer.correct).text.toLowerCase()}`);
          step.values.answer2 = 0;
        }

        return await step.next();
    }
    
    // PERGUNTA 3
    async questions_3(step) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const setQuestionType = await setQuestionsTypeCollection.findOne({}, { skip: 2 });
      const questionTypeId = setQuestionType.questionType;
      
      const questionTypeResult = await questionsTypeCollection.findOne({ _id: questionTypeId });
      const questionType = questionTypeResult.name;
      
      return await askQuestion(step, questionType, "3");
    }
    
    
    // VERIFICA SE A RESPOSTA ESTÁ CERTA OU ERRADA
    async answerQuestion_3(step) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua para o próximo método após 2 segundos
        const userAnswer = step.result.value;
        const question = step.values.currentQuestion_3;
      
        if (userAnswer && userAnswer.toLowerCase() === question.answer.find(answer => answer.correct).text.toLowerCase()) {
          await step.context.sendActivity("Resposta correta!");
          score += 1;
          step.values.answer3 = 1;
          step.values.scoreEquation += 1; // incrementa a pontuação de perguntas de equações
        } else {
          await step.context.sendActivity(`Resposta errada! A resposta certa é ${question.answer.find(answer => answer.correct).text.toLowerCase()}`);
          step.values.answer3 = 0;
        }
        
        return await step.next();
    }

    // PERGUNTA 4
    async questions_4(step) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const setQuestionType = await setQuestionsTypeCollection.findOne({}, { skip: 3 });
      const questionTypeId = setQuestionType.questionType;
      
      const questionTypeResult = await questionsTypeCollection.findOne({ _id: questionTypeId });
      const questionType = questionTypeResult.name;
      
      return await askQuestion(step, questionType, "4");
    }
    
    // VERIFICA SE A RESPOSTA ESTÁ CERTA OU ERRADA
    async answerQuestion_4(step) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua para o próximo método após 2 segundos
        const userAnswer = step.result.value;
        const question = step.values.currentQuestion_4;
      
        if (userAnswer && userAnswer.toLowerCase() === question.answer.find(answer => answer.correct).text.toLowerCase()) {
          await step.context.sendActivity("Resposta correta!");
          score += 1;
          step.values.answer4 = 1;
          step.values.scoreEquation += 1; // incrementa a pontuação de perguntas de equações
        } else {
          await step.context.sendActivity(`Resposta errada! A resposta certa é ${question.answer.find(answer => answer.correct).text.toLowerCase()}`);
          step.values.answer4 = 0;
        }
        
        return await step.next();
    }

    // PERGUNTA 5
    async questions_5(step) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const setQuestionType = await setQuestionsTypeCollection.findOne({}, { skip: 4 });
      const questionTypeId = setQuestionType.questionType;
      
      const questionTypeResult = await questionsTypeCollection.findOne({ _id: questionTypeId });
      const questionType = questionTypeResult.name;
      
      return await askQuestion(step, questionType, "5");
    }
    
    // VERIFICA SE A RESPOSTA ESTÁ CERTA OU ERRADA
    async answerQuestion_5(step) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua para o próximo método após 2 segundos
        const userAnswer = step.result.value;
        const question = step.values.currentQuestion_5;
      
        if (userAnswer && userAnswer.toLowerCase() === question.answer.find(answer => answer.correct).text.toLowerCase()) {
          await step.context.sendActivity("Resposta correta!");
          score += 1;
          step.values.answer5 = 1;
          step.values.scoreDerivative += 1; // incrementa a pontuação de perguntas de derivadas
        } else {
          await step.context.sendActivity(`Resposta errada! A resposta certa é ${question.answer.find(answer => answer.correct).text.toLowerCase()}`);
          step.values.answer5 = 0;
        }
        
        return await step.next();
    }

    // PERGUNTA 6
    async questions_6(step) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const setQuestionType = await setQuestionsTypeCollection.findOne({}, { skip: 5 });
      const questionTypeId = setQuestionType.questionType;
      
      const questionTypeResult = await questionsTypeCollection.findOne({ _id: questionTypeId });
      const questionType = questionTypeResult.name;
      
      return await askQuestion(step, questionType, "6");
    }
    
    // VERIFICA SE A RESPOSTA ESTÁ CERTA OU ERRADA
    async answerQuestion_6(step) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua para o próximo método após 2 segundos
        const userAnswer = step.result.value;
        const question = step.values.currentQuestion_6;
      
        if (userAnswer && userAnswer.toLowerCase() === question.answer.find(answer => answer.correct).text.toLowerCase()) {
          await step.context.sendActivity("Resposta correta!");
          score += 1;
          step.values.answer6 = 1;
          step.values.scoreDerivative += 1; // incrementa a pontuação de perguntas de derivadas
        } else {
          await step.context.sendActivity(`Resposta errada! A resposta certa é ${question.answer.find(answer => answer.correct).text.toLowerCase()}`);
          step.values.answer6 = 0;
        }
        
        return await step.next();
    }

    // PERGUNTA 7
    async questions_7(step) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const setQuestionType = await setQuestionsTypeCollection.findOne({}, { skip: 6 });
      const questionTypeId = setQuestionType.questionType;
      
      const questionTypeResult = await questionsTypeCollection.findOne({ _id: questionTypeId });
      const questionType = questionTypeResult.name;
      
      return await askQuestion(step, questionType, "7");
    }
    
    // VERIFICA SE A RESPOSTA ESTÁ CERTA OU ERRADA
    async answerQuestion_7(step) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua para o próximo método após 2 segundos
        const userAnswer = step.result.value;
        const question = step.values.currentQuestion_7;
      
        if (userAnswer && userAnswer.toLowerCase() === question.answer.find(answer => answer.correct).text.toLowerCase()) {
          await step.context.sendActivity("Resposta correta!");
          score += 1;
          step.values.answer7 = 1;
          step.values.scoreIntegral += 1; // incrementa a pontuação de perguntas de integrais
        } else {
          await step.context.sendActivity(`Resposta errada! A resposta certa é ${question.answer.find(answer => answer.correct).text.toLowerCase()}`);
          step.values.answer7 = 0;
        }
        
        return await step.next();
    }

    // PERGUNTA 8
    async questions_8(step) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const setQuestionType = await setQuestionsTypeCollection.findOne({}, { skip: 7 });
      const questionTypeId = setQuestionType.questionType;
      
      const questionTypeResult = await questionsTypeCollection.findOne({ _id: questionTypeId });
      const questionType = questionTypeResult.name;
      
      return await askQuestion(step, questionType, "8");
    }
    
    // VERIFICA SE A RESPOSTA ESTÁ CERTA OU ERRADA
    async answerQuestion_8(step) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua para o próximo método após 2 segundos
        const userAnswer = step.result.value;
        const question = step.values.currentQuestion_8;
      
        if (userAnswer && userAnswer.toLowerCase() === question.answer.find(answer => answer.correct).text.toLowerCase()) {
          await step.context.sendActivity("Resposta correta!");
          score += 1;
          step.values.answer8 = 1;
          step.values.scoreIntegral += 1; // incrementa a pontuação de perguntas de integrais
        } else {
          await step.context.sendActivity(`Resposta errada! A resposta certa é ${question.answer.find(answer => answer.correct).text.toLowerCase()}`);
          step.values.answer8 = 0;
        }
        
        return await step.next();
    }


    // RESULTADO DAS PERGUNTAS
    async resultsAnswers(step) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      
        // Obter todas as categorias disponíveis a partir da coleção questionsType
        const allCategories = await questionsTypeCollection.distinct("name");

        // Inicializar as estatísticas
        const stats = {};
        allCategories.forEach(category => {
          stats[category] = {
            correct: 0,
            incorrect: 0
          };
        });
              
        // Percorre todas as perguntas respondidas pelo usuário e atualiza as estatísticas de acordo com a categoria
        for (let i = 1; i <= 8; i++) {
          const answer = step.values[`answer${i}`];
          const category = step.values[`currentQuestion_${i}`].type[0].name;
          
          if (answer === 1) {
            stats[category].correct += 1;
          } else {
            stats[category].incorrect += 1;
          }
        }
      
        await step.context.sendActivity(`Chegaste ao fim das perguntas. Conseguiste acertar ${score} em 8.`);
      
        // Verifica em qual categoria o usuário teve mais erros
        let maxErrors = 0;
        let maxErrorsCategory = '';
        Object.entries(stats).forEach(([category, { correct, incorrect }]) => {
          if (incorrect > maxErrors) {
            maxErrors = incorrect;
            maxErrorsCategory = category;
          }
        });

      
        if (maxErrors > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          await step.context.sendActivity(`Notámos que tiveste mais dificuldade com as ${maxErrorsCategory}. Vamos aprender um pouco mais!`);
        }
        step.values.maxErrorsCategory = maxErrorsCategory;
        return await step.next();
    }

    async videos(step) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const maxErrorsCategory = step.values.maxErrorsCategory;
      const videoLink = await getVideoLink(maxErrorsCategory);
    
      await step.context.sendActivity({
        type: 'message',
        attachments: [{
          contentType: 'video/mp4',
          contentUrl: videoLink,
          name: 'Vídeo'
        }]
      });
    
      await new Promise(resolve => setTimeout(resolve, 10000));
      return await step.next();
    }

    async nextStepPrompt(step) {
      await new Promise(resolve => setTimeout(resolve, 2000));  
      const promptMessage = 'Já terminantes de ver o vídeo? O que você queres fazer agora?';
        const retryMessage = 'Por favor, escolha uma opção válida.';
        const choices = ['Ver outro vídeo', 'Ver um artigo'];
      
        return await step.prompt(CHOICE_PROMPT, {
          prompt: promptMessage,
          retryPrompt: retryMessage,
          choices: choices,
        });
      }
      
    async nextStep(step) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const response = step.result && step.result.value;
    
        if (response === 'Ver outro vídeo') {
          const maxErrorsCategory = step.values.maxErrorsCategory;
          const videoLink = await getVideoLink(maxErrorsCategory);
      
          await step.context.sendActivity({
            type: 'message',
            attachments: [{
              contentType: 'video/mp4',
              contentUrl: videoLink,
              name: 'Vídeo'
            }]
          });

        const promptMessage = 'Ver artigo sobre este tópico?';
        const retryMessage = 'Por favor, escolha uma opção válida.';
        const choices = ['Sim', 'Avançar para o teste'];
      
        return await step.prompt(CHOICE_PROMPT, {
          prompt: promptMessage,
          retryPrompt: retryMessage,
          choices: choices,
        });
  
        } else {
    
          return await step.next();
        }
    }

      async documents(step) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      
        const response = step.result && step.result.value;
    
        if (response === 'Sim') {
            const maxErrorsCategory = step.values.maxErrorsCategory;
            const documentLink = await getDocumentLink(maxErrorsCategory);
          
            const pdfFileName = documentLink.name;
            const pdfFile = documentLink.link;
            const pdfUrl = `http://localhost:3000/pdfs/${pdfFile}`;
          
            const pdfAttachment = {
              contentType: 'application/pdf',
              contentUrl: pdfUrl,
              name: pdfFileName,
            };
          
            const replyActivity = {
              type: 'message',
              attachments: [pdfAttachment],
            };
            step.values.newTest = 'Sim';
            await step.context.sendActivity(replyActivity);
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            const promptMessage = 'Vamos iniciar o teste sobre este tópico?';
            const retryMessage = 'Por favor, escolha uma opção válida.';
            const choices = ['Sim', 'Não, sair!'];
      
          return await step.prompt(CHOICE_PROMPT, {
            prompt: promptMessage,
            retryPrompt: retryMessage,
            choices: choices,
          });


        }else{
          const promptMessage = 'Vamos fazer um teste sobre este tópico?';
          const retryMessage = 'Por favor, escolha uma opção válida.';
          const choices = ['Sim', 'Não, sair!'];
      
          return await step.prompt(CHOICE_PROMPT, {
            prompt: promptMessage,
            retryPrompt: retryMessage,
            choices: choices,
          });
        }
      }
      

    async newTest(step) {
        const response = step.result && step.result.value; // para garantir que o código só tenta aceder à propriedade 'value' se step.result estiver definido.
        const newTest = step.values.newTest;
        console.log(response);
        if (response === 'Sim' || newTest === 'Sim') {
            await step.context.sendActivity("Vamos lá testar o que aprendeste!");
            await new Promise(resolve => setTimeout(resolve, 2000)); // Continua após 2 segundos
            return await step.next();
        } else{
            return await endDialog();
        }  
    }  

    // INICIA O TESTE SOBRE O TEMA QUE TEVE MAIS DIFICULDADES NO TESTE DE CONHECIMENTO
    // PERGUNTA 1
    async newTest_1(step) {
      const maxErrorsCategory = step.values.maxErrorsCategory;
      return await askQuestion(step, maxErrorsCategory, "1");
    }
  
    // VERIFICA SE A RESPOSTA ESTÁ CERTA OU ERRADA
    async answerNewTest_1(step) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua para o próximo método após 2 segundos
        const userAnswer = step.result.value;
        const question = step.values.currentQuestion_1;
      
        if (userAnswer && userAnswer.toLowerCase() === question.answer.find(answer => answer.correct).text.toLowerCase()) {
          await step.context.sendActivity("Resposta correta!");
          scoreNewTest += 1;

        } else {
          await step.context.sendActivity(`Resposta errada! A resposta certa é ${question.answer.find(answer => answer.correct).text.toLowerCase()}`);
        }

        return await step.next();
    }

    // PERGUNTA 2
    async newTest_2(step) {
      const maxErrorsCategory = step.values.maxErrorsCategory;
      return await askQuestion(step, maxErrorsCategory, "2");
    }
  
    // VERIFICA SE A RESPOSTA ESTÁ CERTA OU ERRADA
    async answerNewTest_2(step) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua para o próximo método após 2 segundos
        const userAnswer = step.result.value;
        const question = step.values.currentQuestion_2;
      
        if (userAnswer && userAnswer.toLowerCase() === question.answer.find(answer => answer.correct).text.toLowerCase()) {
          await step.context.sendActivity("Resposta correta!");
          scoreNewTest += 1;

        } else {
          await step.context.sendActivity(`Resposta errada! A resposta certa é ${question.answer.find(answer => answer.correct).text.toLowerCase()}`);
        }

        return await step.next();
    }

    // PERGUNTA 3
    async newTest_3(step) {
      const maxErrorsCategory = step.values.maxErrorsCategory;
      return await askQuestion(step, maxErrorsCategory, "3");
    }
  
    // VERIFICA SE A RESPOSTA ESTÁ CERTA OU ERRADA
    async answerNewTest_3(step) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua para o próximo método após 2 segundos
        const userAnswer = step.result.value;
        const question = step.values.currentQuestion_3;
      
        if (userAnswer && userAnswer.toLowerCase() === question.answer.find(answer => answer.correct).text.toLowerCase()) {
          await step.context.sendActivity("Resposta correta!");
          scoreNewTest += 1;

        } else {
          await step.context.sendActivity(`Resposta errada! A resposta certa é ${question.answer.find(answer => answer.correct).text.toLowerCase()}`);
        }

        return await step.next();
    }

    // PERGUNTA 4
    async newTest_4(step) {
      const maxErrorsCategory = step.values.maxErrorsCategory;
      return await askQuestion(step, maxErrorsCategory, "4");
    }
  
    // VERIFICA SE A RESPOSTA ESTÁ CERTA OU ERRADA
    async answerNewTest_4(step) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua para o próximo método após 2 segundos
        const userAnswer = step.result.value;
        const question = step.values.currentQuestion_4;
      
        if (userAnswer && userAnswer.toLowerCase() === question.answer.find(answer => answer.correct).text.toLowerCase()) {
          await step.context.sendActivity("Resposta correta!");
          scoreNewTest += 1;

        } else {
          await step.context.sendActivity(`Resposta errada! A resposta certa é ${question.answer.find(answer => answer.correct).text.toLowerCase()}`);
        }

        return await step.next();
    }

    // PERGUNTA 5
    async newTest_5(step) {
      const maxErrorsCategory = step.values.maxErrorsCategory;
      return await askQuestion(step, maxErrorsCategory, "2");
    }
  
    // VERIFICA SE A RESPOSTA ESTÁ CERTA OU ERRADA
    async answerNewTest_5(step) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua para o próximo método após 2 segundos
        const userAnswer = step.result.value;
        const question = step.values.currentQuestion_5;
      
        if (userAnswer && userAnswer.toLowerCase() === question.answer.find(answer => answer.correct).text.toLowerCase()) {
          await step.context.sendActivity("Resposta correta!");
          scoreNewTest += 1;

        } else {
          await step.context.sendActivity(`Resposta errada! A resposta certa é ${question.answer.find(answer => answer.correct).text.toLowerCase()}`);
        }

        return await step.next();
    }

    // PERGUNTA 6
    async newTest_6(step) {
      const maxErrorsCategory = step.values.maxErrorsCategory;
      return await askQuestion(step, maxErrorsCategory, "2");
    }
  
    // VERIFICA SE A RESPOSTA ESTÁ CERTA OU ERRADA
    async answerNewTest_6(step) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Continua para o próximo método após 2 segundos
        const userAnswer = step.result.value;
        const question = step.values.currentQuestion_6;
      
        if (userAnswer && userAnswer.toLowerCase() === question.answer.find(answer => answer.correct).text.toLowerCase()) {
          await step.context.sendActivity("Resposta correta!");
          scoreNewTest += 1;

        } else {
          await step.context.sendActivity(`Resposta errada! A resposta certa é ${question.answer.find(answer => answer.correct).text.toLowerCase()}`);
        }

        return await step.next();
    }
    
    // RESULTADO DAS PERGUNTAS
    async resultsAnswersNewTest(step) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await step.context.sendActivity(`Chegaste ao fim das perguntas. Conseguiste acertar ${scoreNewTest} em 6.`);
      return await step.next();
    }


    async saveResults(step) {
                       
        try {
            // Connect to MongoDB server
            await client.connect();

            // ### GUARDA NA COLEÇÃO ANWSERS AS RESPOSTAS DO UTILIZADOR ###

            // Select database and collection
            const database01 = client.db(databaseName);
            const collection01 = database01.collection("answers");
    
            // Create a new document to be inserted into the collection
            const newDoc1 = {
                name: step.values.name,
                number: step.values.number,
                question_1 : step.values.questions_1,
                question_2 : step.values.questions_2,
                question_3 : step.values.questions_3,
                question_4 : step.values.questions_4,
                question_5 : step.values.questions_5,
                question_6 : step.values.questions_6,
                question_7 : step.values.questions_7,
                question_8 : step.values.questions_8,
            };                  
    
            // Insert the new document into the collection
            const result1 = await collection01.insertOne(newDoc1);
            console.log(`${result1.insertedCount} document(s) inserted into the collection`);
    
        } catch (err) {
            console.error(err);
        }

        endDialog = true; 
        return await step.endDialog();    
    }

    async isDialogComplete(){
        return endDialog; 
    }
}   
module.exports.MathTutor = MathTutor;